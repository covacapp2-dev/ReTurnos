import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import { useUIStore } from '../stores/uiStore';
import { getAppointments } from '../services/appointments';
import { getProfessionals } from '../services/professionals';
import { getServices } from '../services/services';
import type { Appointment, AppointmentStatus } from '../types';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const START_HOUR = 8;
const END_HOUR = 20;
const HOUR_HEIGHT = 64;

const statusColors: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-500/20 border-l-4 border-amber-500 text-amber-300',
  confirmed: 'bg-emerald-500/20 border-l-4 border-emerald-500 text-emerald-300',
  in_progress: 'bg-purple-500/20 border-l-4 border-purple-500 text-purple-300',
  completed: 'bg-blue-500/20 border-l-4 border-blue-500 text-blue-300',
  cancelled: 'bg-red-500/20 border-l-4 border-red-500 text-red-300',
  no_show: 'bg-gray-500/20 border-l-4 border-gray-500 text-gray-300',
};

const statusDotColors: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-emerald-400',
  in_progress: 'bg-purple-400',
  completed: 'bg-blue-400',
  cancelled: 'bg-red-400',
  no_show: 'bg-gray-400',
};

const statusLabel: Record<AppointmentStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No se presentó',
};

export default function AgendaPage() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const { currentView, setCurrentView } = useUIStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  const dateRange = useMemo(() => {
    switch (currentView) {
      case 'day':
        return { start: currentDate, end: currentDate };
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 }),
        };
      case 'month':
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate),
        };
    }
  }, [currentView, currentDate]);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', business?.id, dateRange.start, dateRange.end],
    queryFn: () =>
      getAppointments(business!.id, {
        startDate: format(dateRange.start, "yyyy-MM-dd'T00:00:00"),
        endDate: format(dateRange.end, "yyyy-MM-dd'T23:59:59"),
      }),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals', business?.id],
    queryFn: () => getProfessionals(business!.id),
    enabled: !!business?.id,
    select: (res) => (res.data ?? []).filter((p) => p.is_active),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => getServices(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const customerMap = useMemo(() => new Map(), []);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((a) => {
      const dateKey = format(parseISO(a.start_time), 'yyyy-MM-dd');
      const existing = map.get(dateKey) ?? [];
      existing.push(a);
      map.set(dateKey, existing);
    });
    return map;
  }, [appointments]);

  const appointmentsByProfessional = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((a) => {
      const key = a.professional_id;
      const existing = map.get(key) ?? [];
      existing.push(a);
      map.set(key, existing);
    });
    return map;
  }, [appointments]);

  const navigatePrev = () => {
    switch (currentView) {
      case 'day':
        setCurrentDate((d) => subDays(d, 1));
        break;
      case 'week':
        setCurrentDate((d) => subWeeks(d, 1));
        break;
      case 'month':
        setCurrentDate((d) => subMonths(d, 1));
        break;
    }
  };

  const navigateNext = () => {
    switch (currentView) {
      case 'day':
        setCurrentDate((d) => addDays(d, 1));
        break;
      case 'week':
        setCurrentDate((d) => addWeeks(d, 1));
        break;
      case 'month':
        setCurrentDate((d) => addMonths(d, 1));
        break;
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const getTitle = () => {
    switch (currentView) {
      case 'day':
        return format(currentDate, "EEEE d 'de' MMMM, yyyy", { locale: es });
      case 'week':
        return `${format(dateRange.start, 'd MMM', { locale: es })} - ${format(dateRange.end, 'd MMM yyyy', { locale: es })}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: es });
    }
  };

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setCurrentView('day');
  };

  const handleSlotClick = (date: Date, hour: number, professionalId?: string) => {
    const params = new URLSearchParams();
    params.set('date', format(date, 'yyyy-MM-dd'));
    params.set('time', `${String(hour).padStart(2, '0')}:00`);
    if (professionalId) params.set('professional', professionalId);
    navigate(`/cargar-reserva?${params.toString()}`);
  };

  const getAppointmentTop = (a: Appointment) => {
    const start = parseISO(a.start_time);
    const hour = start.getHours();
    const minutes = start.getMinutes();
    return ((hour - START_HOUR) * 60 + minutes) * (HOUR_HEIGHT / 60);
  };

  const getAppointmentHeight = (a: Appointment) => {
    const start = parseISO(a.start_time);
    const end = parseISO(a.end_time);
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    return Math.max(durationMinutes * (HOUR_HEIGHT / 60), 24);
  };

  const hours = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i),
    []
  );

  // --- DAY VIEW ---
  const renderDayView = () => {
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const dayAppointments = appointmentsByDate.get(dateKey) ?? [];

    return (
      <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
        <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-[#333]/50"
              style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            >
              <span className="absolute -top-3 left-2 text-xs text-[#9CA3AF] bg-[#080808] px-1">
                {String(hour).padStart(2, '0')}:00
              </span>
              <button
                className="absolute inset-0 w-full h-full opacity-0 hover:opacity-100 hover:bg-[#DC2626]/5 transition-opacity cursor-pointer"
                onClick={() => handleSlotClick(currentDate, hour)}
              />
            </div>
          ))}

          {dayAppointments.map((a) => {
            const top = getAppointmentTop(a);
            const height = getAppointmentHeight(a);
            const start = parseISO(a.start_time);
            const end = parseISO(a.end_time);
            const service = serviceMap.get(a.service_id);

            return (
              <button
                key={a.id}
                onClick={() => navigate(`/reservas/${a.id}`)}
                className={`absolute left-16 right-4 rounded-lg border px-3 py-1.5 text-left transition-all hover:brightness-110 cursor-pointer z-10 ${statusColors[a.status]}`}
                style={{ top, height: Math.max(height, 32) }}
              >
                <div className="font-medium text-xs truncate">
                  {service?.name ?? 'Turno'}
                </div>
                {height > 36 && (
                  <div className="text-[10px] opacity-80">
                    {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // --- WEEK VIEW ---
  const renderWeekView = () => {
    const weekDays = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

    return (
      <div className="grid grid-cols-7 gap-px bg-[#333]/30 rounded-lg overflow-hidden">
        {weekDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayAppointments = appointmentsByDate.get(dateKey) ?? [];
          const isToday = isSameDay(day, new Date());

          return (
            <div key={dateKey} className="bg-[#080808] min-h-[200px]">
              <button
                onClick={() => handleDayClick(day)}
                className={`w-full text-center py-2 border-b border-[#333]/50 transition-colors hover:bg-[#1A1A1A] ${
                  isToday ? 'bg-[#DC2626]/10' : ''
                }`}
              >
                <div className="text-[10px] text-[#9CA3AF] uppercase">
                  {format(day, 'EEE', { locale: es })}
                </div>
                <div
                  className={`text-sm font-semibold ${
                    isToday ? 'text-[#DC2626]' : 'text-white'
                  }`}
                >
                  {format(day, 'd')}
                </div>
              </button>
              <div className="p-1 space-y-1">
                {dayAppointments.slice(0, 6).map((a) => {
                  const start = parseISO(a.start_time);
                  const service = serviceMap.get(a.service_id);

                  return (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/reservas/${a.id}`)}
                      className={`w-full text-left rounded px-2 py-1.5 text-xs cursor-pointer hover:brightness-110 transition-all border-l-2 ${statusColors[a.status]}`}
                    >
                      <div className="font-medium truncate">
                        {format(start, 'HH:mm')}
                      </div>
                      <div className="opacity-80 truncate">
                        {service?.name ?? 'Turno'}
                      </div>
                    </button>
                  );
                })}
                {dayAppointments.length > 6 && (
                  <div className="text-center text-[10px] text-[#9CA3AF] py-1">
                    +{dayAppointments.length - 6} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- MONTH VIEW ---
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

    return (
      <div className="grid grid-cols-7 gap-px bg-[#333]/30 rounded-lg overflow-hidden">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="bg-[#1A1A1A] text-center py-2 text-xs text-[#9CA3AF] font-medium">
            {d}
          </div>
        ))}
        {calDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayAppointments = appointmentsByDate.get(dateKey) ?? [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={dateKey}
              onClick={() => handleDayClick(day)}
              className={`bg-[#080808] min-h-[80px] p-2 text-left transition-colors hover:bg-[#1A1A1A] ${
                !isCurrentMonth ? 'opacity-40' : ''
              }`}
            >
              <div
                className={`text-xs font-medium mb-1 ${
                  isToday
                    ? 'w-5 h-5 rounded-full bg-[#DC2626] text-white flex items-center justify-center'
                    : 'text-white'
                }`}
              >
                {format(day, 'd')}
              </div>
              <div className="flex flex-wrap gap-1">
                {dayAppointments.slice(0, 4).map((a) => (
                  <span
                    key={a.id}
                    className={`w-1.5 h-1.5 rounded-full ${statusDotColors[a.status]}`}
                  />
                ))}
                {dayAppointments.length > 4 && (
                  <span className="text-[8px] text-[#9CA3AF]">
                    +{dayAppointments.length - 4}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Agenda</h1>
        <Button
          icon={<Plus size={18} />}
          onClick={() => navigate('/cargar-reserva')}
        >
          Nueva reserva
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<ChevronLeft size={16} />} onClick={navigatePrev} />
          <h2 className="text-white font-semibold min-w-[200px] text-center text-sm">{getTitle()}</h2>
          <Button variant="ghost" size="sm" icon={<ChevronRight size={16} />} onClick={navigateNext} />
          <Button variant="ghost" size="sm" icon={<CalendarDays size={14} />} onClick={goToToday}>
            Hoy
          </Button>
        </div>

        <div className="flex bg-[#1A1A1A] border border-[#333] rounded-lg p-0.5">
          {(['day', 'week', 'month'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                currentView === view
                  ? 'bg-[#DC2626] text-white'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              {view === 'day' ? 'Día' : view === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <Card padding="none" className="overflow-hidden">
          {currentView === 'day' && renderDayView()}
          {currentView === 'week' && <div className="p-2">{renderWeekView()}</div>}
          {currentView === 'month' && <div className="p-2">{renderMonthView()}</div>}
        </Card>
      )}
    </div>
  );
}
