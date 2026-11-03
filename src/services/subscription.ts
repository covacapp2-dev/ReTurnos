import { supabase } from '@/lib/supabase';

export type PaymentProviderChoice = 'mercadopago' | 'paypal';

// Crea el link de pago mensual en la Edge Function y devuelve la URL
export async function createCheckoutUrl(
  provider: PaymentProviderChoice,
  businessId: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { provider, business_id: businessId },
    });

    if (error) {
      let message = 'No se pudo iniciar el pago. Probá más tarde.';
      try {
        const ctx = (error as { context?: { body?: string } }).context;
        if (ctx?.body) {
          const parsed = JSON.parse(ctx.body);
          if (parsed?.error) message = parsed.error;
        }
      } catch {
        /* sin detalle */
      }
      return { url: null, error: message };
    }

    const url = (data as { url?: string } | null)?.url ?? null;
    if (!url) return { url: null, error: 'No se recibió el link de pago' };

    return { url, error: null };
  } catch {
    return { url: null, error: 'No se pudo conectar con el servidor de pagos' };
  }
}

// Respaldo: al volver de la pasarela, verifica el pago con el proveedor
// y activa la suscripción (por si el webhook no llegó).
export async function confirmPayment(
  provider: PaymentProviderChoice,
  paymentId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('confirm-payment', {
      body: { provider, payment_id: paymentId },
    });
    if (error) return false;
    return Boolean((data as { ok?: boolean } | null)?.ok);
  } catch {
    return false;
  }
}
