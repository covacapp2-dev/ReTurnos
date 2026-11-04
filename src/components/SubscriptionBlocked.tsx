import { Lock, CreditCard, LogOut, Repeat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { detectIsArgentina, getStoredZone } from '../services/subscription';
import { getModeSub, isModeUsable } from '../services/modeSubscriptions';
import { setBookingMode } from '../services/auth';
import type { BookingMode, ModeSubscription } from '../types';
import Button from './ui/Button';

const MODE_LABEL: Record<BookingMode, string> = {
  general: 'Servicio de turnos en general',
  sports: 'Complejo deportivo',
};

// Pantalla de bloqueo: aparece cuando la suscripción de ESTE sistema
// venció o está impaga. No se puede cerrar; salidas → pagar o cambiar
// de sistema (si el otro está vigente).
export default function SubscriptionBlocked({
  mode,
  sub,
}: {
  mode: BookingMode;
  sub?: ModeSubscription | null;
}) {
  const navigate = useNavigate();
  const { business, modeSubs, logout } = useAuthStore();

  const zone = getStoredZone();
  const isArgentina = zone ? zone === 'ar' : detectIsArgentina(business);

  const otherMode: BookingMode = mode === 'sports' ? 'general' : 'sports';
  const otherSub = getModeSub(modeSubs, otherMode);
  const canSwitch = isModeUsable(otherSub);

  const now = Date.now();
  const trialEnded =
    !!sub && sub.status === 'trial' && !!sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() <= now;
  const primaryTrialEnded = trialEnded && !!sub?.is_primary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080808]/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#1A1A1A] border border-[#333] rounded-2xl p-6 md:p-8 text-center shadow-2xl">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#DC2626]/15 border border-[#DC2626]/40 flex items-center justify-center mb-5">
          <Lock size={26} className="text-[#DC2626]" />
        </div>

        <p className="text-xs text-[#9CA3AF] uppercase tracking-wide mb-1">{MODE_LABEL[mode]}</p>

        <h1 className="text-xl md:text-2xl font-bold text-white mb-3">
          {primaryTrialEnded
            ? 'Terminaron tus 3 meses gratis'
            : trialEnded
              ? 'Se terminó el período gratis'
              : 'Suscripción impaga'}
        </h1>

        <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6">
          {primaryTrialEnded
            ? 'Para seguir usando este sistema, activá su suscripción mensual. Cada sistema se paga por separado.'
            : trialEnded
              ? `El período gratis de ${MODE_LABEL[mode].toLowerCase()} terminó. Activá su suscripción para seguir usándolo.`
              : 'Este sistema tiene su propia suscripción y no está al día. Regularizá el pago para reactivarlo al instante.'}
        </p>

        <div className="bg-[#080808] border border-[#333] rounded-lg px-4 py-3 mb-6">
          <span className="text-2xl font-bold text-[#DC2626]">
            {isArgentina ? '$15.000' : 'US$10'}
          </span>
          <span className="text-sm text-[#9CA3AF] ml-1">
            {isArgentina ? 'ARS / mes' : '/ month'}
          </span>
          <p className="text-[11px] text-[#9CA3AF] mt-1">Suscripción de este sistema</p>
        </div>

        <Button
          size="lg"
          className="w-full mb-3"
          onClick={() => navigate(`/subscription?mode=${mode}`)}
          icon={<CreditCard size={18} />}
        >
          Desbloquear y pagar
        </Button>

        {canSwitch && (
          <Button
            variant="secondary"
            className="w-full mb-3"
            icon={<Repeat size={16} />}
            onClick={async () => {
              await setBookingMode(otherMode);
              window.location.href = '/dashboard';
            }}
          >
            Usar {otherMode === 'sports' ? 'el complejo deportivo' : 'los turnos en general'}
          </Button>
        )}

        <button
          onClick={() => logout()}
          className="inline-flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-white transition-colors"
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
