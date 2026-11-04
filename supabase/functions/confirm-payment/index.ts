// ============================================
// ReTurnos - Edge Function: confirm-payment
//
// Respaldo del webhook: cuando el usuario vuelve de la pasarela
// (?payment=success&payment_id=...), verificamos el pago directamente
// con la API del proveedor y activamos la suscripción.
//
// Secretos: MP_ACCESS_TOKEN, PAYPAL_CLIENT_ID/SECRET, PAYPAL_ENV
// ============================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function activateSubscription(
  businessId: string,
  mode: string,
  provider: 'mercadopago' | 'paypal'
) {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const ends = new Date(now);
  ends.setMonth(ends.getMonth() + 1);

  // 1) Suscripción de ESE sistema
  const { data: row } = await supabaseAdmin
    .from('mode_subscriptions')
    .update({
      status: 'active',
      subscription_started_at: now.toISOString(),
      subscription_ends_at: ends.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('business_id', businessId)
    .eq('mode', mode)
    .select('is_primary')
    .maybeSingle();

  if (row) {
    if (row.is_primary) {
      await supabaseAdmin
        .from('businesses')
        .update({
          subscription_status: 'active',
          payment_provider: provider,
          subscription_started_at: now.toISOString(),
          subscription_ends_at: ends.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', businessId);
    }
    return true;
  }

  // 2) Respaldo sin la tabla mode_subscriptions
  const { data } = await supabaseAdmin
    .from('businesses')
    .update({
      subscription_status: 'active',
      payment_provider: provider,
      subscription_started_at: now.toISOString(),
      subscription_ends_at: ends.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', businessId)
    .select('id')
    .single();

  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'No autorizado' }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) return json({ error: 'No autorizado' }, 401);
    const user = authData.user;

    const { provider, payment_id } = await req.json();
    if (!provider || !payment_id) return json({ ok: false, msg: 'faltan datos' }, 400);

    // --- MercadoPago ---
    if (provider === 'mercadopago') {
      const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
      if (!mpToken) return json({ ok: false, msg: 'MP no configurado' }, 500);

      const resp = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });
      const payment = await resp.json();
      if (!resp.ok || payment.status !== 'approved') {
        return json({ ok: false, msg: 'pago no aprobado' });
      }

      const amount = Number(payment.transaction_amount ?? 0);
      if (payment.currency_id !== 'ARS' || amount < 15000) {
        return json({ ok: false, msg: 'importe inválido' });
      }

      const ref = payment.external_reference;
      if (!ref) return json({ ok: false, msg: 'sin referencia' });

      const [businessId, mode = 'general'] = String(ref).split('|');

      // Que solo el dueño pueda activar su negocio
      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('id, owner_id')
        .eq('id', businessId)
        .single();
      if (!business || business.owner_id !== user.id) return json({ error: 'No autorizado' }, 403);

      const activated = await activateSubscription(businessId, mode, 'mercadopago');
      return json({ ok: activated });
    }

    // --- PayPal ---
    if (provider === 'paypal') {
      const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
      const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
      if (!clientId || !clientSecret) return json({ ok: false, msg: 'PayPal no configurado' }, 500);

      const apiBase =
        Deno.env.get('PAYPAL_ENV') === 'live'
          ? 'https://api-m.paypal.com'
          : 'https://api-m.sandbox.paypal.com';

      const basic = btoa(`${clientId}:${clientSecret}`);
      const tokenResp = await fetch(`${apiBase}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      const tokenJson = await tokenResp.json();
      if (!tokenResp.ok || !tokenJson.access_token) {
        return json({ ok: false, msg: 'PayPal no autorizó' }, 500);
      }

      const auth = { Authorization: `Bearer ${tokenJson.access_token}` };

      // Si la orden todavía no está capturada, la capturamos
      let order = await (
        await fetch(`${apiBase}/v2/checkout/orders/${payment_id}`, { headers: auth })
      ).json();

      if (order?.status !== 'COMPLETED') {
        order = await (
          await fetch(`${apiBase}/v2/checkout/orders/${payment_id}/capture`, {
            method: 'POST',
            headers: { ...auth, 'Content-Type': 'application/json' },
          })
        ).json();
      }

      if (order?.status !== 'COMPLETED') return json({ ok: false, msg: 'pago no completado' });

      const unit = order.purchase_units?.[0];
      const amount = Number(unit?.amount?.value ?? 0);
      if (unit?.amount?.currency_code !== 'USD' || amount < 10) {
        return json({ ok: false, msg: 'importe inválido' });
      }

      const ref = unit?.custom_id;
      if (!ref) return json({ ok: false, msg: 'sin referencia' });

      const [businessId, mode = 'general'] = String(ref).split('|');

      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('id, owner_id')
        .eq('id', businessId)
        .single();
      if (!business || business.owner_id !== user.id) return json({ error: 'No autorizado' }, 403);

      const activated = await activateSubscription(businessId, mode, 'paypal');
      return json({ ok: activated });
    }

    return json({ error: 'Proveedor inválido' }, 400);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Error al confirmar el pago' },
      500
    );
  }
});
