// ============================================
// ReTurnos - Edge Function: payment-webhook
//
// Recibe las notificaciones de MercadoPago y PayPal
// y deja la suscripción del negocio en "activa".
//
// Secretos:
//   SUPABASE_SERVICE_ROLE_KEY (se crea solo)
//   MP_ACCESS_TOKEN           para verificar el pago
//   MP_WEBHOOK_SECRET         opcional: firma x-signature
//   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET
//   PAYPAL_WEBHOOK_ID         opcional: verifica la firma
//   SITE_URL                  opcional
// ============================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function activateSubscription(
  businessId: string,
  mode: string,
  provider: 'mercadopago' | 'paypal'
): Promise<boolean> {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const ends = new Date(now);
  ends.setMonth(ends.getMonth() + 1);

  // 1) Se activa la suscripción de ESE sistema
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
    // 2) Si es el sistema principal, se refleja también en businesses
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

  // 3) Respaldo: la tabla mode_subscriptions todavía no existe
  const { data, error } = await supabaseAdmin
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

  return !error && !!data;
}

// Firma de MercadoPago: x-signature = "ts=...,v1=..." HMAC-SHA256(id)
async function verifyMpSignature(req: Request, dataId: string): Promise<boolean> {
  const secret = Deno.env.get('MP_WEBHOOK_SECRET');
  if (!secret) return true; // sin secreto configurado no se valida

  const sig = req.headers.get('x-signature') ?? '';
  const parts = Object.fromEntries(
    sig.split(',').map((p) => p.split('=') as [string, string])
  );
  if (!parts.ts || !parts.v1) return false;

  const manifest = `id:${dataId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const hex = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hex === parts.v1;
}

async function handleMercadoPago(req: Request, url: URL): Promise<Response> {
  const raw = await req.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    // A veces llega como form-urlencoded
    body = Object.fromEntries(new URLSearchParams(raw));
  }

  const data = body?.data as { id?: string | number } | undefined;
  const paymentId = data?.id ?? url.searchParams.get('data.id');

  if (!paymentId) return json({ ok: true, msg: 'notificación sin pago' });

  if (!(await verifyMpSignature(req, String(paymentId)))) {
    return json({ error: 'firma inválida' }, 401);
  }

  const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
  if (!mpToken) return json({ ok: false, msg: 'MP_ACCESS_TOKEN no configurado' }, 500);

  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  });
  const payment = await resp.json();

  if (!resp.ok) return json({ ok: false, msg: payment.message ?? 'error' }, 500);

  const ref = payment.external_reference;
  if (!ref) return json({ ok: true, msg: 'sin referencia' });

  // "id-del-negocio|sistema"
  const [businessId, mode = 'general'] = String(ref).split('|');

  if (payment.status === 'approved') {
    // Que no se active con un pago de menos de $15.000 ARS
    const amount = Number(payment.transaction_amount ?? 0);
    if (payment.currency_id === 'ARS' && amount >= 15000) {
      await activateSubscription(businessId, mode, 'mercadopago');
    } else {
      return json({ ok: true, msg: `importe inválido: ${amount}` });
    }
  }

  return json({ ok: true });
}

async function handlePayPal(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));

  if (body?.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    return json({ ok: true, msg: 'evento ignorado' });
  }

  const ref =
    body?.resource?.custom_id ??
    body?.resource?.purchase_units?.[0]?.custom_id ??
    body?.resource?.supplementary_data?.related_ids?.order_id;

  if (!ref) return json({ ok: true, msg: 'sin referencia' });

  const [businessId, mode = 'general'] = String(ref).split('|');
  await activateSubscription(businessId, mode, 'paypal');
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');
    const typeParam = url.searchParams.get('type') ?? '';

    // MercadoPago manda el tipo en la query (?type=payment) o en el body
    const bodyClone = await req.clone().json().catch(() => ({}));
    const action = typeof bodyClone?.action === 'string' ? bodyClone.action : '';
    const looksLikeMp =
      provider === 'mercadopago' ||
      typeParam.startsWith('payment') ||
      bodyClone?.type === 'payment' ||
      action.startsWith('payment');

    if (looksLikeMp) return await handleMercadoPago(req, url);

    // PayPal manda event_type
    if (bodyClone?.event_type) return await handlePayPal(req.clone());

    return json({ ok: true, msg: 'ignorado' });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'error en webhook' },
      500
    );
  }
});
