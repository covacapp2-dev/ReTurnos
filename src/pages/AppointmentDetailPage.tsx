import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  CreditCard,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  Edit3,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import {
  getAppointment,
  updateAppointment,
  cancelAppointment,
  completeAppointment,
} from '../services/appointments';
import { getCustomer } from '../services/customers';
import { getService } from '../services/services';
import { getProfessional } from '../services/professionals';
import type { AppointmentStatus } from '../types';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import LoadingSpinner from '../components/ui/LoadingSpinner';

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

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { business } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editModal, setEditModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [editForm, setEditForm] = useState({ notes: '', internalNotes: '' });

  const { data: appointment, isLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => getAppointment(id!),
    enabled: !!id,
    select: (res) => res.data,
  });

  const { data: customer } = useQuery({
    queryKey: ['customer', appointment?.customer_id],
    queryFn: () => getCustomer(appointment!.customer_id),
    enabled: !!appointment?.customer_id,
    select: (res) => res.data,
  });

  const { data: service } = useQuery({
    queryKey: ['service', appointment?.service_id],
    queryFn: () => getService(appointment!.service_id),
    enabled: !!appointment?.service_id,
    select: (res) => res.data,
  });

  const { data: professional } = useQuery({
    queryKey: ['professional', appointment?.professional_id],
    queryFn: () => getProfessional(appointment!.professional_id),
    enabled: !!appointment?.professional_id,
    select: (res) => res.data,
  });

  const confirmMut = useMutation({
    mutationFn: () => updateAppointment(id!, { status: 'confirmed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      toast.success('Turno confirmado');
    },
    onError: () => toast.error('Error al confirmar turno'),
  });

  const completeMut = useMutation({
    mutationFn: () => completeAppointment(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      toast.success('Turno completado');
    },
    onError: () => toast.error('Error al completar turno'),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelAppointment(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      toast.success('Turno cancelado');
      setCancelModal(false);
    },
    onError: () => toast.error('Error al cancelar turno'),
  });

  const updateNotesMut = useMutation({
    mutationFn: () =>
      updateAppointment(id!, {
        notes: editForm.notes || null,
        internal_notes: editForm.internalNotes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      toast.success('Notas actualizadas');
      setEditModal(false);
    },
    onError: () => toast.error('Error al actualizar notas'),
  });

  if (isLoading) return <LoadingSpinner />;
  if (!appointment) {
    return (
      <div className="text-center py-16">
        <p className="text-[#9CA3AF]">Turno no encontrado.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/reservas')}>
          Volver a reservas
        </Button>
      </div>
    );
  }

  const startDate = parseISO(appointment.start_time);
  const endDate = parseISO(appointment.end_time);
  const isActive = appointment.status === 'pending' || appointment.status === 'confirmed';

  const openEdit = () => {
    setEditForm({
      notes: appointment.notes ?? '',
      internalNotes: appointment.internal_notes ?? '',
    });
    setEditModal(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          icon={<ArrowLeft size={18} />}
          onClick={() => navigate('/reservas')}
        >
          Volver
        </Button>
        <h1 className="text-2xl font-bold text-white">Detalle del turno</h1>
        <Badge variant={statusBadgeVariant[appointment.status]} dot>
          {statusLabel[appointment.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 text-[#9CA3AF] text-xs mb-3">
            <Calendar size={14} />
            <span>Fecha y hora</span>
          </div>
          <div className="text-white font-semibold">
            {format(startDate, "EEEE d 'de' MMMM", { locale: es })}
          </div>
          <div className="text-[#9CA3AF] text-sm mt-1">
            {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-[#9CA3AF] text-xs mb-3">
            <User size={14} />
            <span>Cliente</span>
          </div>
          <div className="text-white font-semibold">{customer?.full_name ?? '—'}</div>
          <div className="text-[#9CA3AF] text-sm mt-1">
            {customer?.email && <div>{customer.email}</div>}
            {customer?.phone && <div>{customer.phone}</div>}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-[#9CA3AF] text-xs mb-3">
            <FileText size={14} />
            <span>Servicio</span>
          </div>
          <div className="text-white font-semibold">{service?.name ?? '—'}</div>
          <div className="text-[#9CA3AF] text-sm mt-1">
            {service?.duration_minutes} minutos
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-[#9CA3AF] text-xs mb-3">
            <User size={14} />
            <span>Profesional</span>
          </div>
          <div className="text-white font-semibold">
            {professional?.full_name ?? '—'}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 text-[#9CA3AF] text-xs mb-3">
          <CreditCard size={14} />
          <span>Pago</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-semibold">
              {service?.price != null ? `$${service.price.toFixed(2)}` : '—'}
            </div>
            <div className="text-[#9CA3AF] text-sm mt-0.5">
              Estado:{' '}
              <span className="text-white">
                {appointment.payment_status === 'paid'
                  ? 'Pagado'
                  : appointment.payment_status === 'pending'
                  ? 'Pendiente'
                  : appointment.payment_status}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {(appointment.notes || appointment.internal_notes) && (
        <Card>
          {appointment.notes && (
            <div className="mb-4">
              <div className="text-xs text-[#9CA3AF] mb-1">Notas del cliente</div>
              <p className="text-white text-sm whitespace-pre-wrap">{appointment.notes}</p>
            </div>
          )}
          {appointment.internal_notes && (
            <div>
              <div className="text-xs text-[#9CA3AF] mb-1">Notas internas</div>
              <p className="text-white text-sm whitespace-pre-wrap">
                {appointment.internal_notes}
              </p>
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-2 text-[#9CA3AF] text-xs mb-3">
          <Clock size={14} />
          <span>Historial</span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Creado</span>
            <span className="text-white">
              {format(parseISO(appointment.created_at), "dd/MM/yyyy HH:mm")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Actualizado</span>
            <span className="text-white">
              {format(parseISO(appointment.updated_at), "dd/MM/yyyy HH:mm")}
            </span>
          </div>
          {appointment.cancelled_at && (
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Cancelado</span>
              <span className="text-white">
                {format(parseISO(appointment.cancelled_at), "dd/MM/yyyy HH:mm")}
              </span>
            </div>
          )}
          {appointment.completed_at && (
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Completado</span>
              <span className="text-white">
                {format(parseISO(appointment.completed_at), "dd/MM/yyyy HH:mm")}
              </span>
            </div>
          )}
          {appointment.cancellation_reason && (
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Motivo cancelación</span>
              <span className="text-white">{appointment.cancellation_reason}</span>
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        {isActive && (
          <>
            {appointment.status === 'pending' && (
              <Button
                icon={<CheckCircle2 size={16} />}
                onClick={() => confirmMut.mutate()}
                loading={confirmMut.isPending}
              >
                Confirmar
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<CheckCircle2 size={16} />}
              onClick={() => completeMut.mutate()}
              loading={completeMut.isPending}
            >
              Completar
            </Button>
            <Button
              variant="danger"
              icon={<XCircle size={16} />}
              onClick={() => setCancelModal(true)}
            >
              Cancelar
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          icon={<Edit3 size={16} />}
          onClick={openEdit}
        >
          Editar notas
        </Button>
      </div>

      <Modal
        isOpen={cancelModal}
        onClose={() => setCancelModal(false)}
        title="Cancelar turno"
        maxWidth="sm"
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={20} className="text-amber-400 shrink-0" />
          <p className="text-[#9CA3AF] text-sm">
            ¿Estás seguro de que deseas cancelar este turno? Esta acción no se puede deshacer.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setCancelModal(false)}>
            No, volver
          </Button>
          <Button
            variant="danger"
            loading={cancelMut.isPending}
            onClick={() => cancelMut.mutate()}
          >
            Sí, cancelar
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title="Editar notas"
        maxWidth="md"
      >
        <div className="space-y-4">
          <Textarea
            label="Notas del cliente"
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            placeholder="Notas visibles para el cliente..."
          />
          <Textarea
            label="Notas internas"
            value={editForm.internalNotes}
            onChange={(e) => setEditForm({ ...editForm, internalNotes: e.target.value })}
            placeholder="Notas solo para el equipo..."
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditModal(false)}>
              Cancelar
            </Button>
            <Button
              loading={updateNotesMut.isPending}
              onClick={() => updateNotesMut.mutate()}
            >
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
