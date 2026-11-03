import { useMemo, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CreditCard,
  Clock,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { createCheckoutUrl, confirmPayment, hasActiveAccess, detectIsArgentina, getStoredZone, storeZone } from '../services/subscription';
import type { PaymentZone } from '../services/subscription';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

export default function SubscriptionPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { business } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [zoneOverride, setZoneOverride] = useState<PaymentZone | null>(() => getStoredZone());

  const detectedAr = useMemo(() => detectIsArgentina(business), [business]);
  const isArgentina = zoneOverride ? zoneOverride === 'ar' : detectedAr;

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
        ['payment', 'payment_id', 'collection_id', 'collection_status', 'token', 'PayerID', 'status'].forEach(
          (k) => clean.searchParams.delete(k)
        );
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

  const checkoutMut = useMutation({
    mutationFn: () =>
      createCheckoutUrl(isArgentina ? 'mercadopago' : 'paypal', business!.id),
    onSuccess: ({ url, error }) => {
      if (error) {
        toast.error(error);
        return;
      }
      if (url) window.location.href = url;
    },
    onError: () => toast.error('No se pudo iniciar el pago. Probá más tarde.'),
  });

  const trialDaysLeft = useMemo(() => {
    if (!business?.trial_ends_at) return 0;
    const days = differenceInDays(new Date(business.trial_ends_at), new Date());
    return Math.max(0, days);
  }, [business?.trial_ends_at]);

  const trialProgress = useMemo(() => {
    if (!business?.trial_started_at || !business?.trial_ends_at) return 0;
    const start = new Date(business.trial_started_at).getTime();
    const end = new Date(business.trial_ends_at).getTime();
    const now = Date.now();
    const total = end - start;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }, [business?.trial_started_at, business?.trial_ends_at]);

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

      <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Suscripción</h1>

      {/* Aviso de bloqueo */}
      {!hasActiveAccess(business) && (
        <div className="mb-6 flex items-start gap-3 bg-[#DC2626]/10 border border-[#DC2626]/40 rounded-lg p-4">
          <Lock size={18} className="text-[#DC2626] mt-0.5 shrink-0" />
          <p className="text-sm text-white">
            <span className="font-semibold">El acceso está pausado.</span>{' '}
            <span className="text-[#9CA3AF]">
              Hacé el pago y la suscripción se activa al instante.
            </span>
          </p>
        </div>
      )}

      {/* Zona de cobro */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
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

      {/* Subscription Plan Card */}
      <Card className="mb-6 border-[#DC2626]/30">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Suscripción mensual</h2>
            <p className="text-sm text-[#9CA3AF] mt-1">
              Acceso ilimitado a todas las funcionalidades
            </p>
          </div>
          <Badge
            variant={
              hasActiveAccess(business)
                ? business?.subscription_status === 'active'
                  ? 'success'
                  : 'warning'
                : 'danger'
            }
            dot
          >
            {hasActiveAccess(business)
              ? business?.subscription_status === 'active'
                ? 'Activo'
                : 'Prueba'
              : 'Vencido'}
          </Badge>
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold text-[#DC2626]">
            {isArgentina ? '$15.000' : 'US$10'}
          </span>
          <span className="text-sm text-[#9CA3AF]">
            {isArgentina ? 'ARS / mes' : '/ mes'}
          </span>
        </div>

        <div className="bg-[#080808] border border-[#333] rounded-lg p-3 mb-4">
          <p className="text-sm text-emerald-400 font-medium">
            🎁 3 meses gratis al suscribirte
          </p>
        </div>

        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={!business}
          loading={checkoutMut.isPending}
          onClick={() => checkoutMut.mutate()}
          icon={<CreditCard size={18} />}
        >
          {isArgentina ? 'Pagar con Mercado Pago' : 'Pagar con PayPal'}
        </Button>
        <p className="text-xs text-[#9CA3AF] mt-3">
          {isArgentina
            ? 'Se abre Mercado Pago en una pestaña nueva para pagar $15.000 ARS.'
            : 'Se abre PayPal en una pestaña nueva para pagar US$ 10.'}
        </p>
      </Card>

      {/* Trial Info */}
      {business?.subscription_status === 'trial' && (
        <Card className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Clock size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Período de prueba</h3>
              <p className="text-xs text-[#9CA3AF]">
                Te quedan {trialDaysLeft} días de prueba
              </p>
            </div>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-[#9CA3AF] mb-1">
              <span>Inicio</span>
              <span>Fin</span>
            </div>
            <div className="h-2 bg-[#333] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#DC2626] to-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${trialProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-[#9CA3AF] mt-1">
              <span>
                {business?.trial_started_at
                  ? format(new Date(business.trial_started_at), 'dd MMM yyyy', { locale: es })
                  : '-'}
              </span>
              <span>
                {business?.trial_ends_at
                  ? format(new Date(business.trial_ends_at), 'dd MMM yyyy', { locale: es })
                  : '-'}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Cómo funciona el cobro */}
      <Card>
        <h3 className="text-sm font-semibold text-white mb-3">Cómo funciona el cobro</h3>
        <ul className="space-y-2 text-sm text-[#9CA3AF]">
          <li className="flex gap-2">
            <span className="text-[#DC2626]">•</span>
            <span>
              Los primeros <span className="text-white font-medium">3 meses son gratis</span>.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#DC2626]">•</span>
            <span>
              Después se paga mes a mes: {isArgentina ? '$15.000 ARS' : 'US$10'}.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#DC2626]">•</span>
            <span>Al pagar, la suscripción se activa al instante y dura 30 días.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#DC2626]">•</span>
            <span>Si vence, el acceso queda pausado hasta regularizar el pago.</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
