import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  DollarSign,
  Users,
  Package,
  Plus,
  CalendarCheck,
  Settings,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { getAppointments } from '../services/appointments';
import { getCustomers } from '../services/customers';
import { getServices } from '../services/services';
import { getRevenueStats } from '../services/reports';
import type { Appointment } from '../types';

interface EnrichedAppointment extends Appointment {
  customer_name?: string;
  service_name?: string;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  pending: 'warning',
  confirmed: 'info',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'danger',
};

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile, business } = useAuth();

  const [todayCount, setTodayCount] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [recentAppointments, setRecentAppointments] = useState<EnrichedAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const businessId = business?.id;

  useEffect(() => {
    if (!businessId) return;

    async function fetchData() {
      const bid = businessId;
      if (!bid) return;
      setLoading(true);

      const now = new Date();
      const todayStart = format(new Date(now.getFullYear(), now.getMonth(), now.getDate()), "yyyy-MM-dd'T'00:00:00");
      const todayEnd = format(new Date(now.getFullYear(), now.getMonth(), now.getDate()), "yyyy-MM-dd'T'23:59:59");
      const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd'T'00:00:00");
      const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd'T'23:59:59");

      const [todayResult, monthResult, customersResult, servicesResult, recentResult] =
        await Promise.all([
          getAppointments(bid, { startDate: todayStart, endDate: todayEnd }),
          getRevenueStats(bid, { startDate: monthStart, endDate: monthEnd }),
          getCustomers(bid),
          getServices(bid),
          getAppointments(bid, { startDate: todayStart }),
        ]);

      if (todayResult.data) setTodayCount(todayResult.data.length);
      if (monthResult.data) setMonthRevenue(monthResult.data.total_revenue);
      if (customersResult.data) setCustomerCount(customersResult.data.length);
      if (servicesResult.data) setServiceCount(servicesResult.data.length);

      if (recentResult.data) {
        const sorted = recentResult.data
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
          .slice(0, 5);

        const customerIds = [...new Set(sorted.map((a) => a.customer_id))];
        const serviceIds = [...new Set(sorted.map((a) => a.service_id))];

        const [customersData, servicesData] = await Promise.all([
          Promise.all(
            customerIds.map(async (id) => {
              const { data } = await import('../services/customers').then((m) =>
                m.getCustomer(id)
              );
              return { id, name: data?.full_name ?? 'Desconocido' };
            })
          ),
          Promise.all(
            serviceIds.map(async (id) => {
              const { data } = await import('../services/services').then((m) =>
                m.getService(id)
              );
              return { id, name: data?.name ?? 'Desconocido' };
            })
          ),
        ]);

        const customerMap = new Map(customersData.map((c) => [c.id, c.name]));
        const serviceMap = new Map(servicesData.map((s) => [s.id, s.name]));

        setRecentAppointments(
          sorted.map((a) => ({
            ...a,
            customer_name: customerMap.get(a.customer_id),
            service_name: serviceMap.get(a.service_id),
          }))
        );
      }

      setLoading(false);
    }

    fetchData().catch(() => {
      toast.error('Error al cargar datos del dashboard');
      setLoading(false);
    });
  }, [businessId]);

  const quickActions = [
    {
      label: 'Cargar reserva',
      icon: Plus,
      path: '/appointments/new',
      color: 'bg-[#DC2626]',
    },
    {
      label: 'Agenda',
      icon: CalendarCheck,
      path: '/agenda',
      color: 'bg-blue-600',
    },
    {
      label: 'Clientes',
      icon: Users,
      path: '/clients',
      color: 'bg-emerald-600',
    },
    {
      label: 'Configuración',
      icon: Settings,
      path: '/settings',
      color: 'bg-purple-600',
    },
  ];

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuario';

  return (
    <div className="min-h-screen bg-[#080808] p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          {getTimeGreeting()}, {firstName}
        </h1>
        <p className="text-[#9CA3AF] mt-1">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        {quickActions.map((action) => (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className="flex flex-col items-center gap-3 p-4 md:p-5 bg-[#1A1A1A] border border-[#333] rounded-xl hover:border-[#DC2626]/50 transition-colors"
          >
            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${action.color}`}>
              <action.icon size={22} className="text-white" />
            </div>
            <span className="text-sm font-medium text-white text-center">
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
            <StatCard
              icon={Calendar}
              value={todayCount}
              label="Reservas hoy"
              iconColor="#DC2626"
            />
            <StatCard
              icon={DollarSign}
              value={`$${monthRevenue.toLocaleString('es-AR')}`}
              label="Ingresos del mes"
              iconColor="#16A34A"
            />
            <StatCard
              icon={Users}
              value={customerCount}
              label="Clientes activos"
              iconColor="#2563EB"
            />
            <StatCard
              icon={Package}
              value={serviceCount}
              label="Servicios"
              iconColor="#9333EA"
            />
          </div>

          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Próximas reservas</h2>
              <button
                onClick={() => navigate('/agenda')}
                className="text-sm text-[#DC2626] hover:text-[#EF4444] transition-colors"
              >
                Ver agenda
              </button>
            </div>

            {recentAppointments.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="Sin reservas"
                description="No hay reservas programadas para hoy"
                actionLabel="Cargar reserva"
                onAction={() => navigate('/appointments/new')}
              />
            ) : (
              <div className="space-y-3">
                {recentAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-3 bg-[#080808] rounded-lg border border-[#333]"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={appointment.customer_name} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {appointment.customer_name}
                        </p>
                        <p className="text-xs text-[#9CA3AF]">
                          {appointment.service_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex items-center gap-1 text-xs text-[#9CA3AF]">
                        <Clock size={14} />
                        {format(new Date(appointment.start_time), 'HH:mm')}
                      </div>
                      <Badge
                        variant={statusVariant[appointment.status] ?? 'default'}
                        dot
                      >
                        {statusLabel[appointment.status] ?? appointment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
