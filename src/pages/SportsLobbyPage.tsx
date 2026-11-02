import { useNavigate } from 'react-router-dom';
import {
  CalendarPlus,
  ShoppingBag,
  Calendar,
  CalendarCheck,
  Package,
  BarChart3,
  Settings,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import { SPORTS } from '../constants/sports';

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const QUICK_LINKS = [
  { label: 'Agenda', icon: Calendar, path: '/agenda' },
  { label: 'Reservas', icon: CalendarCheck, path: '/appointments' },
  { label: 'Servicios', icon: Package, path: '/services' },
  { label: 'Reportes', icon: BarChart3, path: '/reports' },
  { label: 'Configuración', icon: Settings, path: '/settings' },
];

export default function SportsLobbyPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuario';

  return (
    <div className="flex flex-col lg:h-[calc(100vh-7rem)] lg:overflow-hidden p-4 md:p-6 max-w-7xl mx-auto">
      {/* Saludo + acciones rápidas */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {getTimeGreeting()}, {firstName}
          </h1>
          <p className="text-[#9CA3AF] mt-1">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={<ShoppingBag size={18} />} onClick={() => navigate('/sales/new')}>
            Cargar venta
          </Button>
          <Button
            variant="secondary"
            icon={<CalendarPlus size={18} />}
            onClick={() => navigate('/appointments/new')}
          >
            Cargar turno
          </Button>
        </div>
      </div>

      {/* Deportes */}
      <div className="shrink-0 mb-4">
        <h2 className="text-lg font-semibold text-white mb-1">Elegí un deporte</h2>
        <p className="text-sm text-[#9CA3AF]">
          Tocá un deporte para ver sus canchas y cargar turnos.
        </p>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
        {SPORTS.map((sport) => (
          <button
            key={sport.label}
            onClick={() => navigate(`/sports/${encodeURIComponent(sport.label)}`)}
            className="flex flex-col items-center justify-center gap-2 p-4 md:p-5 bg-[#1A1A1A] border border-[#333] rounded-xl hover:border-[#DC2626]/60 hover:bg-[#1A1A1A]/80 transition-all duration-200 text-center"
          >
            <div className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#111827] border border-[#333] text-2xl md:text-3xl">
              <span>{sport.emoji}</span>
            </div>
            <span className="text-sm font-semibold text-white">{sport.label}</span>
            <span className="text-[11px] text-[#9CA3AF] leading-snug hidden sm:block">
              {sport.description}
            </span>
          </button>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div className="shrink-0 flex flex-wrap gap-2">
        {QUICK_LINKS.map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#333] bg-[#1A1A1A] text-sm text-[#9CA3AF] hover:text-white hover:border-[#DC2626]/50 transition-colors"
          >
            <link.icon size={15} className="text-[#DC2626]" />
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
