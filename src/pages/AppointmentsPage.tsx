import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CalendarCheck,
  Plus,
  Eye,
  Pencil,
  XCircle,
  CheckCircle2,
  Calendar,
  Filter,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import {
  getAppointments,
  cancelAppointment,
  completeAppointment,
} from '../services/appointments';
import { getCustomers } from '../services/customers';
import { getServices } from '../services/services';
import { getProfessionals } from '../services/professionals';
import type { Appointment, AppointmentStatus } from '../types';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SearchInput from '../components/ui/SearchInput';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'no_show', label: 'No se presentó' },
];

const statusBadgeVariant: Record<AppointmentStatus, 'warning' | 'success' | 'info' | 'danger' | 'default'> = {
  pending: 'warning',
  confirmed: 'success',
  in_progress: 'info',
  completed: 'info',
  cancelled: 'danger',
  no_show: 'default',
};

const statusLabel: Record<AppointmentStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No se presentó',
};

export default function AppointmentsPage() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [professionalFilter, setProfessionalFilter] = useState('');
  const [cancelModal, setCancelModal] = useState<string | null>(null);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', business?.id],
    queryFn: () => getAppointments(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', business?.id],
    queryFn: () => getCustomers(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => getServices(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals', business?.id],
    queryFn: () => getProfessionals(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );
  const serviceMap = useMemo(
    () => new Map(services.map((s) => [s.id, s])),
    [services]
  );
  const professionalMap = useMemo(
    () => new Map(professionals.map((p) => [p.id, p])),
    [professionals]
  );

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelAppointment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', business?.id] });
      toast.success('Turno cancelado');
      setCancelModal(null);
    },
    onError: () => toast.error('Error al cancelar turno'),
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => completeAppointment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', business?.id] });
      toast.success('Turno completado');
    },
    onError: () => toast.error('Error al completar turno'),
  });

  const professionalOptions = useMemo(
    () => [
      { value: '', label: 'Todos los profesionales' },
      ...professionals.map((p) => ({ value: p.id, label: p.full_name })),
    ],
    [professionals]
  );

  const filtered = useMemo(() => {
    let result = appointments;
    if (statusFilter) {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (professionalFilter) {
      result = result.filter((a) => a.professional_id === professionalFilter);
    }
    if (search.length >= 2) {
      const term = search.toLowerCase();
      result = result.filter((a) => {
        const customer = customerMap.get(a.customer_id);
        return customer?.full_name.toLowerCase().includes(term);
      });
    }
    return result;
  }, [appointments, statusFilter, professionalFilter, search, customerMap]);

  const handleSearch = useCallback((value: string) => setSearch(value), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Reservas</h1>
        <Button
          icon={<Plus size={18} />}
          onClick={() => navigate('/cargar-reserva')}
        >
          Nueva reserva
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          placeholder="Buscar por nombre de cliente..."
          onChange={handleSearch}
          className="sm:max-w-xs"
        />
        <div className="flex gap-3">
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Select
            options={professionalOptions}
            value={professionalFilter}
            onChange={(e) => setProfessionalFilter(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Sin reservas"
          description="No se encontraron reservas con los filtros aplicados."
          actionLabel="Nueva reserva"
          onAction={() => navigate('/cargar-reserva')}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Fecha</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Hora</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF] hidden md:table-cell">Servicio</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF] hidden lg:table-cell">Profesional</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Estado</th>
                  <th className="text-right px-5 py-3 font-medium text-[#9CA3AF] hidden sm:table-cell">Precio</th>
                  <th className="text-right px-5 py-3 font-medium text-[#9CA3AF]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const customer = customerMap.get(a.customer_id);
                  const service = serviceMap.get(a.service_id);
                  const professional = professionalMap.get(a.professional_id);
                  const startDate = parseISO(a.start_time);

                  return (
                    <tr
                      key={a.id}
                      className="border-b border-[#333]/50 last:border-0 hover:bg-[#222] transition-colors"
                    >
                      <td className="px-5 py-3.5 text-white whitespace-nowrap">
                        {format(startDate, 'dd MMM yyyy', { locale: es })}
                      </td>
                      <td className="px-5 py-3.5 text-white whitespace-nowrap">
                        {format(startDate, 'HH:mm')}
                      </td>
                      <td className="px-5 py-3.5 text-white font-medium">
                        {customer?.full_name ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[#9CA3AF] hidden md:table-cell">
                        {service?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[#9CA3AF] hidden lg:table-cell">
                        {professional?.full_name ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={statusBadgeVariant[a.status]} dot>
                          {statusLabel[a.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-white text-right hidden sm:table-cell">
                        {service?.price != null
                          ? `$${service.price.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Eye size={15} />}
                            onClick={() => navigate(`/reservas/${a.id}`)}
                          />
                          {(a.status === 'pending' || a.status === 'confirmed') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<CheckCircle2 size={15} />}
                                onClick={() => completeMut.mutate(a.id)}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<XCircle size={15} />}
                                onClick={() => setCancelModal(a.id)}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={!!cancelModal}
        onClose={() => setCancelModal(null)}
        title="Cancelar turno"
        maxWidth="sm"
      >
        <p className="text-[#9CA3AF] text-sm mb-5">
          ¿Estás seguro de que deseas cancelar este turno? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setCancelModal(null)}>
            No, volver
          </Button>
          <Button
            variant="danger"
            loading={cancelMut.isPending}
            onClick={() => cancelModal && cancelMut.mutate(cancelModal)}
          >
            Sí, cancelar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
