import { useMemo, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CreditCard,
  Lock,
  ArrowLeft,
  Check,
  CalendarDays,
  Goal,
  Repeat,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import {
  createCheckoutUrl,
  confirmPayment,
  detectIsArgentina,
  getStoredZone,
  storeZone,
} from '../services/subscription';
import type { PaymentZone } from '../services/subscription';
import {
  getModeSub,
  modeState,
  currentBookingMode,
} from '../services/modeSubscriptions';
import { setBookingMode } from '../services/auth';
import type { BookingMode, ModeSubscription } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const MODES: {
  value: BookingMode;
  label: string;
  short: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  {
    value: 'general',
    label: 'Servicio de turnos en general',
    short: 'Turnos en general',
    description: 'Dashboard con servicios, profesionales y clientes de cualquier rubro.',
    icon: CalendarDays,
  },
  {
    value: 'sports',
    label: 'Servicio de turnos complejo deportivo',
    short: 'Complejo deportivo',
    description: 'Lobby con deportes y canchas de fútbol, pádel, tenis, etc.',
    icon: Goal,
  },
];

function fmt(iso: string | null): string {
  if (!iso) return '';
  try {
    return format(new Date(iso), 'dd/MM/yyyy', { locale: es });
  } catch {
    return iso;
  }
}

export default function SubscriptionPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { business, user, modeSubs } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [zoneOverride, setZoneOverride] = useState<PaymentZone | null>(() => getStoredZone());

  const detectedAr = useMemo(() => detectIsArgentina(business), [business]);
  const isArgentina = zoneOverride ? zoneOverride === 'ar' : detectedAr;

  const currentMode = currentBookingMode(user);
  const requestedMode = searchParams.get('mode');

  const chooseZone = (zone: PaymentZone) => {
    setZoneOverride(zone);
    storeZone(zone);
  };

  // Volvimos del proveedor de pago
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (!payment) return;

    if (payment === 'success') {
      // MercadoPago manda payment_id/collection_id, PayPal manda token
      const paymentId =
        searchParams.get('payment_id') ??
        searchParams.get('collection_id') ??
        searchParams.get('token');

      toast.success('Pago recibido. Verificando tu suscripción…', { duration: 4000 });

      (async () => {
        if (paymentId) {
          await confirmPayment(isArgentina ? 'mercadopago' : 'paypal', paymentId);
        }
        // Volvemos sin los parámetros para no repetir la confirmación
        const clean = new URL(window.location.href);
        [
          'payment',
          'payment_id',
          'collection_id',
          'collection_status',
          'token',
          'PayerID',
          'status',
          'mode',
        ].forEach((k) => clean.searchParams.delete(k));
        window.location.replace(clean.toString());
      })();

      return;
    }

    if (payment === 'fallo') toast.error('El pago no se completó. Podés intentarlo de nuevo.');
    if (payment === 'pendiente')
      toast('Pago en proceso. Te lo activamos cuando se acredite.', { duration: 5000 });

    searchParams.delete('payment');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, isArgentina]);

  // Un pago por sistema: cada botón paga la suscripción de su sistema
  const checkoutMut = useMutation({
    mutationFn: (mode: BookingMode) =>
      createCheckoutUrl(isArgentina ? 'mercadopago' : 'paypal', business!.id, mode),
    onSuccess: ({ url, error }) => {
      if (error) {
        toast.error(error);
        return;
      }
      if (url) window.location.href = url;
    },
    onError: () => toast.error('No se pudo iniciar el pago. Probá más tarde.'),
  });

  const switchMut = useMutation({
    mutationFn: (mode: BookingMode) => setBookingMode(mode),
    onSuccess: () => {
      toast.success('Sistema cambiado');
      window.location.href = '/dashboard';
    },
    onError: () => toast.error('No se pudo cambiar de sistema'),
  });

  const currentSub = getModeSub(modeSubs, currentMode);
  const currentBlocked = currentSub
    ? !['active', 'trial'].includes(currentSub.status) ||
      (currentSub.status === 'trial' &&
        !!currentSub.trial_ends_at &&
        new Date(currentSub.trial_ends_at).getTime() <= Date.now()) ||
      (currentSub.status === 'active' &&
        !!currentSub.subscription_ends_at &&
        new Date(currentSub.subscription_ends_at).getTime() <= Date.now())
    : false;

  const payLabel = isArgentina ? 'Pagar con Mercado Pago' : 'Pagar con PayPal';

  return (
    <div
      className={
        embedded ? '' : 'min-h-screen bg-[#080808] p-4 md:p-6 max-w-4xl mx-auto'
      }
    >
      {!embedded && (
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 text-[#9CA3AF] hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Volver a configuración
        </button>
      )}

      <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Suscripción</h1>
      <p className="text-sm text-[#9CA3AF] mb-6">
        Cada sistema se paga por separado. Si usás los dos, pagás dos suscripciones.
      </p>

      {/* Aviso de bloqueo del sistema en uso */}
      {currentBlocked && (
        <div className="mb-6 flex items-start gap-3 bg-[#DC2626]/10 border border-[#DC2626]/40 rounded-lg p-4">
          <Lock size={18} className="text-[#DC2626] mt-0.5 shrink-0" />
          <p className="text-sm text-white">
            <span className="font-semibold">El sistema que estás usando está pausado.</span>{' '}
            <span className="text-[#9CA3AF]">
              Hacé el pago y se reactiva al instante.
            </span>
          </p>
        </div>
      )}

      {/* Zona de cobro */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#9CA3AF] mr-1">Cobro en:</span>
        <button
          onClick={() => chooseZone('ar')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            isArgentina
              ? 'bg-[#DC2626] border-[#DC2626] text-white'
              : 'bg-[#1A1A1A] border-[#333] text-[#9CA3AF] hover:text-white'
          }`}
        >
          🇦🇷 Argentina · Mercado Pago
        </button>
        <button
          onClick={() => chooseZone('intl')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !isArgentina
              ? 'bg-[#DC2626] border-[#DC2626] text-white'
              : 'bg-[#1A1A1A] border-[#333] text-[#9CA3AF] hover:text-white'
          }`}
        >
          🌍 Resto del mundo · PayPal
        </button>
      </div>

      {/* Una tarjeta por sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {MODES.map((m) => {
          const sub = getModeSub(modeSubs, m.value) as ModeSubscription | null;
          const state = modeState(sub);
          const usable = state.kind === 'active' || state.kind === 'trial';
          const isCurrent = currentMode === m.value;
          const highlighted = requestedMode === m.value;
          const Icon = m.icon;

          return (
            <Card
              key={m.value}
              className={`${highlighted ? 'border-[#DC2626] ring-1 ring-[#DC2626]/40' : 'border-[#333]'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={20} className={isCurrent ? 'text-[#DC2626]' : 'text-[#9CA3AF]'} />
                  <h2 className="text-sm font-semibold text-white truncate">{m.short}</h2>
                </div>
                {isCurrent && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#DC2626]/15 text-[#DC2626] border border-[#DC2626]/40 shrink-0">
                    En uso
                  </span>
                )}
              </div>

              <p className="text-xs text-[#9CA3AF] leading-snug mb-4">{m.description}</p>

              {/* Estado */}
              <div className="bg-[#080808] border border-[#333] rounded-lg px-3 py-2.5 mb-4">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm font-medium ${
                      state.kind === 'active'
                        ? 'text-emerald-400'
                        : state.kind === 'trial'
                          ? 'text-amber-400'
                          : 'text-[#DC2626]'
                    }`}
                  >
                    {state.kind === 'active' && <Check size={14} className="inline mr-1 -mt-0.5" />}
                    {state.label}
                  </span>
                  {state.endsAt && (
                    <span className="text-[11px] text-[#9CA3AF]">hasta {fmt(state.endsAt)}</span>
                  )}
                </div>
                {state.kind === 'trial' && sub?.is_primary && state.endsAt && (
                  <p className="text-[11px] text-[#9CA3AF] mt-1">
                    Te quedan {Math.max(0, Math.ceil((new Date(state.endsAt).getTime() - Date.now()) / 86400000))}{" "}
                    días
                  </p>
                )}
              </div>

              {/* Precio */}
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-bold text-[#DC2626]">
                  {isArgentina ? '$15.000' : 'US$10'}
                </span>
                <span className="text-xs text-[#9CA3AF]">
                  {isArgentina ? 'ARS / mes' : '/ mes'}
                </span>
              </div>

              {/* Acciones */}
              {state.kind === 'active' ? (
                <Button variant="secondary" className="w-full" disabled icon={<Check size={16} />}>
                  Suscripción activa
                </Button>
              ) : state.kind === 'trial' ? (
                <div className="text-center text-xs text-[#9CA3AF] py-2">
                  {sub?.is_primary
                    ? 'Disfrutá tus 3 meses gratis. Después se paga mes a mes.'
                    : 'Período gratis en curso. Cuando termine, se paga mes a mes.'}
                </div>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={!business}
                    loading={checkoutMut.isPending && checkoutMut.variables === m.value}
                    onClick={() => checkoutMut.mutate(m.value)}
                    icon={<CreditCard size={18} />}
                  >
                    {payLabel}
                  </Button>
                  <p className="text-[11px] text-[#9CA3AF] mt-2 text-center">
                    {isArgentina
                      ? 'Se abre Mercado Pago para pagar $15.000 ARS.'
                      : 'Se abre PayPal para pagar US$ 10.'}
                  </p>
                </>
              )}

              {/* Usar el otro sistema */}
              {!isCurrent && usable && (
                <button
                  onClick={() => switchMut.mutate(m.value)}
                  disabled={switchMut.isPending}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 text-xs text-[#9CA3AF] hover:text-white transition-colors"
                >
                  <Repeat size={13} />
                  Usar este sistema
                </button>
              )}
            </Card>
          );
        })}
      </div>

      {/* Cómo funciona el cobro */}
      <Card>
        <h3 className="text-sm font-semibold text-white mb-3">Cómo funciona el cobro</h3>
        <ul className="space-y-2 text-sm text-[#9CA3AF]">
          <li className="flex gap-2">
            <span className="text-[#DC2626]">•</span>
            <span>
              El sistema elegido al registrarse tiene{' '}
              <span className="text-white font-medium">3 meses gratis</span>.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#DC2626]">•</span>
            <span>
              El otro sistema queda <span className="text-white font-medium">gratis hasta fin del mes</span>{' '}
              y después se bloquea hasta pagarlo.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#DC2626]">•</span>
            <span>
              Después se paga mes a mes: {isArgentina ? '$15.000 ARS' : 'US$10'} por sistema.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#DC2626]">•</span>
            <span>Al pagar, ese sistema se activa al instante y dura 30 días.</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
