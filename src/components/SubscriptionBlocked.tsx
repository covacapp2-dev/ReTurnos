import { Lock, CreditCard, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import Button from './ui/Button';

// Pantalla de bloqueo: se muestra cuando la suscripción venció o está impaga.
// No se puede cerrar; única salida → pagar (o cerrar sesión).
export default function SubscriptionBlocked() {
  const navigate = useNavigate();
  const { business, logout } = useAuthStore();

  const isArgentina = (() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz.startsWith('America/Argentina') || navigator.language.includes('es-AR');
    } catch {
      return false;
    }
  })();

  const expired = business?.subscription_status === 'trial';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080808]/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#1A1A1A] border border-[#333] rounded-2xl p-6 md:p-8 text-center shadow-2xl">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#DC2626]/15 border border-[#DC2626]/40 flex items-center justify-center mb-5">
          <Lock size={26} className="text-[#DC2626]" />
        </div>

        <h1 className="text-xl md:text-2xl font-bold text-white mb-3">
          {expired ? 'Tu prueba terminó' : 'Suscripción impaga'}
        </h1>

        <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6">
          {expired ? (
            <>
              Se cumplieron los <span className="text-white font-medium">3 meses gratis</span> de tu
              cuenta. Para seguir usando ReTurnos, activá tu suscripción mensual.
            </>
          ) : (
            <>
              Tu suscripción no está al día, por lo que el acceso quedó pausado. Regularizá el pago
              y se reactiva al instante.
            </>
          )}
        </p>

        <div className="bg-[#080808] border border-[#333] rounded-lg px-4 py-3 mb-6">
          <span className="text-2xl font-bold text-[#DC2626]">
            {isArgentina ? '$15.000' : 'US$10'}
          </span>
          <span className="text-sm text-[#9CA3AF] ml-1">
            {isArgentina ? 'ARS / mes' : '/ month'}
          </span>
        </div>

        <Button
          size="lg"
          className="w-full mb-3"
          onClick={() => navigate('/subscription')}
          icon={<CreditCard size={18} />}
        >
          Ir a pagar ahora
        </Button>

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
