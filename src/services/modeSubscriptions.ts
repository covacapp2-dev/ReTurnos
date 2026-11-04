import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { BookingMode, ModeSubscription } from '../types';

// Sistema que el usuario está usando ahora (el que eligió al registrarse
// o el que cambió desde Configuración → Tipo de sistema)
export function currentBookingMode(user?: User | null): BookingMode {
  return user?.user_metadata?.booking_mode === 'sports' ? 'sports' : 'general';
}

// Suscripción de cada sistema (general / sports) por separado.
// Solo lectura desde el navegador (RLS): quién cambia estados es el
// servidor (webhook de pago / confirm-payment / admin-api).

export async function fetchModeSubscriptions(
  businessId: string
): Promise<ModeSubscription[]> {
  const { data, error } = await supabase
    .from('mode_subscriptions')
    .select('*')
    .eq('business_id', businessId);

  if (error) return [];
  return (data ?? []) as ModeSubscription[];
}

export function getModeSub(
  subs: ModeSubscription[] | null | undefined,
  mode: BookingMode
): ModeSubscription | null {
  if (!subs || subs.length === 0) return null;
  return subs.find((s) => s.mode === mode) ?? null;
}

export type ModeStateKind = 'active' | 'trial' | 'blocked' | 'unknown';

export interface ModeState {
  kind: ModeStateKind;
  label: string;
  endsAt: string | null;
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR');
  } catch {
    return iso;
  }
}

// Estado legible de la suscripción de un sistema
export function modeState(sub: ModeSubscription | null | undefined): ModeState {
  if (!sub) return { kind: 'unknown', label: 'Sin datos', endsAt: null };
  const now = Date.now();

  if (sub.status === 'active') {
    if (!sub.subscription_ends_at) return { kind: 'active', label: 'Activa', endsAt: null };
    return { kind: 'active', label: 'Activa', endsAt: sub.subscription_ends_at };
  }

  if (sub.status === 'trial') {
    if (!sub.trial_ends_at || new Date(sub.trial_ends_at).getTime() > now) {
      return {
        kind: 'trial',
        label: sub.is_primary ? '3 meses gratis' : `Gratis hasta ${fmt(sub.trial_ends_at!)}`,
        endsAt: sub.trial_ends_at,
      };
    }
    return { kind: 'blocked', label: 'Período gratis vencido', endsAt: sub.trial_ends_at };
  }

  if (sub.status === 'locked') {
    return { kind: 'blocked', label: 'Bloqueado', endsAt: null };
  }

  return { kind: 'blocked', label: 'Suscripción impaga', endsAt: null };
}

// ¿Se puede usar este sistema ahora?
export function isModeUsable(sub: ModeSubscription | null | undefined): boolean {
  const state = modeState(sub);
  return state.kind === 'active' || state.kind === 'trial';
}

// Habilitar el sistema que quedó bloqueado al registrarse:
// gratis hasta fin del mes en curso (solo se puede una vez).
export async function enableMode(
  businessId: string,
  mode: BookingMode
): Promise<{ error: string | null; subs: ModeSubscription[] }> {
  const { error } = await supabase.rpc('enable_mode', { p_mode: mode });
  if (error) return { error: error.message, subs: [] };

  const subs = await fetchModeSubscriptions(businessId);
  return { error: null, subs };
}
