import { useNavigate } from 'react-router-dom';
import {
  CalendarPlus,
  Calendar,
  CalendarCheck,
  Package,
  Boxes,
  Users,
  UserCircle,
  Clock,
  Building2,
  BarChart3,
  CreditCard,
  Settings,
  User,
  HelpCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const menuItems = [
  { label: 'Cargar reserva', icon: CalendarPlus, path: '/appointments/new' },
  { label: 'Agenda', icon: Calendar, path: '/agenda' },
  { label: 'Reservas', icon: CalendarCheck, path: '/appointments' },
  { label: 'Servicios', icon: Package, path: '/services' },
  { label: 'Recursos', icon: Boxes, path: '/resources' },
  { label: 'Profesionales', icon: Users, path: '/professionals' },
  { label: 'Clientes', icon: UserCircle, path: '/clients' },
  { label: 'Horarios', icon: Clock, path: '/horarios' },
  { label: 'Sucursales', icon: Building2, path: '/branches' },
  { label: 'Reportes', icon: BarChart3, path: '/reports' },
  { label: 'Pagos', icon: CreditCard, path: '/subscription' },
  { label: 'Configuración', icon: Settings, path: '/settings' },
  { label: 'Mi cuenta', icon: User, path: '/account' },
  { label: 'Soporte', icon: HelpCircle, path: '/support' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuario';

  return (
    <div className="min-h-screen bg-[#080808] p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          {getTimeGreeting()}, {firstName}
        </h1>
        <p className="text-[#9CA3AF] mt-1">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3 md:gap-4">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center justify-center gap-3 p-5 md:p-6 bg-[#1A1A1A] border border-[#333] rounded-xl hover:border-[#DC2626]/50 hover:bg-[#1A1A1A]/80 transition-all duration-200 group"
          >
            <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-[#111827] border border-[#333] group-hover:border-[#DC2626]/30 transition-colors">
              <item.icon size={28} className="text-[#DC2626]" />
            </div>
            <span className="text-sm font-medium text-white text-center leading-tight">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
