import { supabase } from '@/lib/supabase';
import type { Business } from '../types/database';

export type PaymentProviderChoice = 'mercadopago' | 'paypal';

// ¿Puede usar la app? Suscripción activa o prueba vigente.
// Si no, se bloquea el acceso y se lo manda a pagar.
export function hasActiveAccess(business: Business | null | undefined): boolean {
  if (!business) return false;
  const now = Date.now();

  if (business.subscription_status === 'active') {
    if (!business.subscription_ends_at) return true;
    return new Date(business.subscription_ends_at).getTime() > now;
  }

  if (business.subscription_status === 'trial') {
    if (!business.trial_ends_at) return true;
    return new Date(business.trial_ends_at).getTime() > now;
  }

  // past_due / cancelled / expired
  return false;
}

// --- Zona de cobro: Argentina (MercadoPago) o resto del mundo (PayPal) ---

export const PAYMENT_ZONE_KEY = 'retornos_payment_zone';
export type PaymentZone = 'ar' | 'intl';

export function detectIsArgentina(business?: { currency?: string } | null): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    if (tz.startsWith('America/Argentina')) return true;

    const lang = (navigator.language ?? '').toLowerCase();
    if (lang === 'es-ar' || lang.startsWith('es-ar')) return true;
  } catch {
    /* sin detección */
  }

  // Si la moneda del negocio es ARS → se cobra en pesos
  return business?.currency === 'ARS';
}

export function getStoredZone(): PaymentZone | null {
  try {
    const v = localStorage.getItem(PAYMENT_ZONE_KEY);
    return v === 'ar' || v === 'intl' ? v : null;
  } catch {
    return null;
  }
}

export function storeZone(zone: PaymentZone): void {
  try {
    localStorage.setItem(PAYMENT_ZONE_KEY, zone);
  } catch {
    /* sin storage */
  }
}

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
