import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
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
  Settings,
  User,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../lib/utils';
import { signOut } from '../../services/auth';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/appointments/new', icon: CalendarPlus, label: 'Cargar reserva' },
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
  { to: '/appointments', icon: CalendarCheck, label: 'Reservas' },
  { to: '/services', icon: Package, label: 'Servicios' },
  { to: '/resources', icon: Boxes, label: 'Recursos' },
  { to: '/professionals', icon: Users, label: 'Profesionales' },
  { to: '/clients', icon: UserCircle, label: 'Clientes' },
  { to: '/horarios', icon: Clock, label: 'Horarios' },
  { to: '/branches', icon: Building2, label: 'Sucursales' },
  { to: '/reports', icon: BarChart3, label: 'Reportes' },
  { to: '/settings', icon: Settings, label: 'Configuración' },
  { to: '/account', icon: User, label: 'Mi cuenta' },
  { to: '/support', icon: HelpCircle, label: 'Soporte' },
];

export default function Sidebar() {
  const { business } = useAuthStore();
  const { sidebarCollapsed, toggleSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen } = useUIStore();

  const isCollapsed = sidebarCollapsed;

  function handleNavClick() {
    if (mobileMenuOpen) setMobileMenuOpen(false);
  }

  async function handleLogout() {
    await signOut();
    useAuthStore.getState().logout();
    window.location.href = '/login';
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div
        className={cn(
          'flex items-center h-16 border-b border-[#333] shrink-0',
          isCollapsed ? 'justify-center px-2' : 'px-5'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/logo.png" alt="ReTurnos" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          {!isCollapsed && (
            <span className="text-white font-bold text-lg tracking-tight truncate">
              ReTurnos
            </span>
          )}
        </div>
      </div>

      {business?.name && !isCollapsed && (
        <div className="px-5 py-3 border-b border-[#333]">
          <p className="text-xs text-[#9CA3AF] truncate">{business.name}</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150',
                      isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                      isActive
                        ? 'bg-[#DC2626]/10 text-[#DC2626] border-l-[3px] border-[#DC2626]'
                        : 'text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white border-l-[3px] border-transparent'
                    )
                  }
                >
                  <Icon size={20} className="shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[#333] p-2 shrink-0">
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 rounded-lg text-sm font-medium w-full transition-colors duration-150',
            'text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white',
            isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
          )}
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span>Cerrar sesión</span>}
        </button>
      </div>

      <button
        onClick={toggleSidebarCollapsed}
        className={cn(
          'hidden lg:flex items-center justify-center h-10 border-t border-[#333] transition-colors duration-150',
          'text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white'
        )}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 bg-[#0A0A0A] border-r border-[#333] z-30 transition-all duration-300',
          isCollapsed ? 'w-[70px]' : 'w-[250px]'
        )}
      >
        {sidebarContent}
      </aside>

      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 bg-[#0A0A0A] border-r border-[#333] z-50 w-[250px] transition-transform duration-300 ease-in-out',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
