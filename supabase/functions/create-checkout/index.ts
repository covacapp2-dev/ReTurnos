// ============================================
// ReTurnos - Edge Function: create-checkout
//
// Crea el link de pago mensual:
//   - MercadoPago (Argentina, ARS 15.000)
//   - PayPal (resto del mundo, US$ 10)
//
// Secretos (Supabase → Settings → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN      token privado de MercadoPago
//   PAYPAL_CLIENT_ID     client id de PayPal
//   PAYPAL_CLIENT_SECRET client secret de PayPal
//   PAYPAL_ENV           opcional: "live" para producción (default sandbox)
//   SITE_URL             opcional: https://re-turnos.vercel.app
// ============================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://re-turnos.vercel.app';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/payment-webhook`;

const PRICE_ARS = 15000;
const PRICE_USD = '10.00';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // --- Autenticar al usuario ---
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'No autorizado' }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) return json({ error: 'No autorizado' }, 401);
    const user = authData.user;

    const { provider, business_id } = await req.json();
    if (!provider || !business_id) return json({ error: 'Faltan datos' }, 400);

    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id, name')
      .eq('id', business_id)
      .single();

    if (!business || business.owner_id !== user.id) {
      return json({ error: 'No autorizado' }, 403);
    }

    // --- MercadoPago (Argentina) ---
    if (provider === 'mercadopago') {
      const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
      if (!mpToken) {
        return json(
          { error: 'Los pagos con Mercado Pago todavía no están configurados en el servidor.' },
          500
        );
      }

      const prefResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              id: 'retornos-suscripcion-mensual',
              title: 'ReTurnos - Suscripción mensual',
              quantity: 1,
              unit_price: PRICE_ARS,
              currency_id: 'ARS',
            },
          ],
          external_reference: business.id,
          notification_url: `${WEBHOOK_URL}?provider=mercadopago`,
          back_urls: {
            success: `${SITE_URL}/subscription?payment=success`,
            pending: `${SITE_URL}/subscription?payment=pendiente`,
            failure: `${SITE_URL}/subscription?payment=fallo`,
          },
          auto_return: 'approved',
          statement_descriptor: 'RETORNOS',
        }),
      });

      const preference = await prefResp.json();
      if (!prefResp.ok || !preference.init_point) {
        return json(
          { error: preference.message ?? 'Mercado Pago no pudo crear el pago' },
          500
        );
      }

      return json({ url: preference.init_point });
    }

    // --- PayPal (resto del mundo) ---
    if (provider === 'paypal') {
      const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
      const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
      if (!clientId || !clientSecret) {
        return json(
          { error: 'Los pagos con PayPal todavía no están configurados en el servidor.' },
          500
        );
      }

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
        return json({ error: 'PayPal no pudo autorizar los pagos' }, 500);
      }

      const orderResp = await fetch(`${apiBase}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: { currency_code: 'USD', value: PRICE_USD },
              description: 'ReTurnos - Monthly subscription',
              custom_id: business.id,
            },
          ],
          application_context: {
            return_url: `${SITE_URL}/subscription?payment=success`,
            cancel_url: `${SITE_URL}/subscription?payment=fallo`,
            brand_name: 'ReTurnos',
          },
        }),
      });

      const order = await orderResp.json();
      const approve = order.links?.find(
        (l: { rel: string; href: string }) => l.rel === 'approve'
      );

      if (!orderResp.ok || !approve) {
        return json({ error: order.message ?? 'PayPal no pudo crear el pago' }, 500);
      }

      return json({ url: approve.href });
    }

    return json({ error: 'Proveedor de pago inválido' }, 400);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Error inesperado al crear el pago' },
      500
    );
  }
});
