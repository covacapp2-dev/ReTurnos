import { useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CreditCard,
  Clock,
  AlertTriangle,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { createCheckoutUrl, confirmPayment } from '../services/subscription';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

function detectIsArgentina(): boolean {
  try {
    const lang = navigator.language;
    if (lang.includes('es-AR') || lang.includes('es-AR')) return true;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === 'America/Argentina/Buenos_Aires' || tz === 'America/Cordoba' || tz === 'America/Argentina/Salta';
  } catch {
    return false;
  }
}

const PAYMENT_HISTORY = [
  { date: '2026-08-01', amount: 15000, status: 'paid', method: 'Mercado Pago' },
  { date: '2026-07-01', amount: 15000, status: 'paid', method: 'Mercado Pago' },
  { date: '2026-06-01', amount: 0, status: 'free', method: 'Trial' },
];

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { business } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isArgentina = useMemo(() => detectIsArgentina(), []);

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
    <div className="min-h-screen bg-[#080808] p-4 md:p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-2 text-[#9CA3AF] hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Volver a configuración
      </button>

      <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Suscripción</h1>

      {/* Subscription Plan Card */}
      <Card className="mb-6 border-[#DC2626]/30">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isArgentina ? 'Suscripción mensual' : 'International subscription'}
            </h2>
            <p className="text-sm text-[#9CA3AF] mt-1">
              {isArgentina ? 'Acceso ilimitado a todas las funcionalidades' : 'Unlimited access to all features'}
            </p>
          </div>
          <Badge variant={business?.subscription_status === 'active' ? 'success' : business?.subscription_status === 'trial' ? 'warning' : 'danger'} dot>
            {business?.subscription_status === 'active' ? 'Activo' : business?.subscription_status === 'trial' ? 'Prueba' : 'Inactivo'}
          </Badge>
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold text-[#DC2626]">
            {isArgentina ? '$15.000' : 'US$10'}
          </span>
          <span className="text-sm text-[#9CA3AF]">
            {isArgentina ? 'ARS / mes' : '/ month'}
          </span>
        </div>

        <div className="bg-[#080808] border border-[#333] rounded-lg p-3 mb-4">
          <p className="text-sm text-emerald-400 font-medium">
            {isArgentina ? '🎁 3 meses gratis al suscribirte' : '🎁 3 months free when you subscribe'}
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
          {isArgentina ? 'Pagar con Mercado Pago' : 'Pay with PayPal'}
        </Button>
        <p className="text-xs text-[#9CA3AF] mt-3">
          {isArgentina
            ? 'Se abre Mercado Pago en una pestaña nueva para pagar $15.000 ARS.'
            : 'Opens PayPal in a new tab to pay US$ 10.'}
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

      {/* Payment History */}
      <Card className="mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Historial de pagos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#333]">
                <th className="text-left px-4 py-2 font-medium text-[#9CA3AF]">Fecha</th>
                <th className="text-left px-4 py-2 font-medium text-[#9CA3AF]">Monto</th>
                <th className="text-left px-4 py-2 font-medium text-[#9CA3AF]">Estado</th>
                <th className="text-left px-4 py-2 font-medium text-[#9CA3AF]">Método</th>
              </tr>
            </thead>
            <tbody>
              {PAYMENT_HISTORY.map((payment, i) => (
                <tr key={i} className="border-b border-[#333]/50 last:border-0">
                  <td className="px-4 py-3 text-white">
                    {format(new Date(payment.date), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3 text-white">
                    {payment.amount === 0
                      ? 'Gratis'
                      : `$${payment.amount.toLocaleString('es-AR')}`}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={payment.status === 'paid' ? 'success' : 'info'}
                      dot
                    >
                      {payment.status === 'paid' ? 'Pagado' : 'Trial'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{payment.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Cancel */}
      {business?.subscription_status !== 'cancelled' && (
        <Card className="border-red-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white mb-1">Cancelar suscripción</h3>
              <p className="text-xs text-[#9CA3AF] mb-3">
                Si cancelás, tu cuenta seguirá activa hasta el final del período facturado.
              </p>
              <Button variant="danger" size="sm">
                Cancelar suscripción
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
