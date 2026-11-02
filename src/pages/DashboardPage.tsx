import { useNavigate } from 'react-router-dom';
import {
  CalendarPlus,
  Calendar,
  CalendarCheck,
  Package,
  ShoppingBag,
  Users,
  UserCircle,
  Clock,
  Building2,
  BarChart3,
  Settings,
  User,
  HelpCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const menuItems = [
  { label: 'Agenda', icon: Calendar, path: '/agenda' },
  { label: 'Reservas', icon: CalendarCheck, path: '/appointments' },
  { label: 'Servicios', icon: Package, path: '/services' },
  { label: 'Productos', icon: ShoppingBag, path: '/products' },
  { label: 'Profesionales', icon: Users, path: '/professionals' },
  { label: 'Clientes', icon: UserCircle, path: '/clients' },
  { label: 'Horarios', icon: Clock, path: '/horarios' },
  { label: 'Sucursales', icon: Building2, path: '/branches' },
  { label: 'Reportes', icon: BarChart3, path: '/reports' },
  { label: 'Configuración', icon: Settings, path: '/settings' },
  { label: 'Mi cuenta', icon: User, path: '/account' },
  { label: 'Soporte', icon: HelpCircle, path: '/support' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuario';

  return (
    <div className="flex flex-col lg:h-[calc(100vh-7rem)] lg:overflow-hidden p-4 md:p-6 max-w-7xl mx-auto">
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
          <Button
            icon={<ShoppingBag size={18} />}
            onClick={() => navigate('/sales/new')}
          >
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

      <div className="flex-1 min-h-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 lg:grid-rows-3">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center justify-center gap-3 p-4 md:p-5 bg-[#1A1A1A] border border-[#333] rounded-xl hover:border-[#DC2626]/50 hover:bg-[#1A1A1A]/80 transition-all duration-200 group"
          >
            <div className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#111827] border border-[#333] group-hover:border-[#DC2626]/30 transition-colors">
              <item.icon size={24} className="text-[#DC2626]" />
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
