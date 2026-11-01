import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  Search,
  Clock,
  Calendar,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  format,
  addDays,
  startOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import {
  createAppointment,
  getAvailableSlots,
} from '../services/appointments';
import { searchCustomers, createCustomer } from '../services/customers';
import { getServices } from '../services/services';
import { getProfessionals, getProfessionalsForService } from '../services/professionals';
import type { Customer, Service, Professional } from '../types';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const STEPS = ['Cliente', 'Servicio', 'Profesional', 'Fecha', 'Hora', 'Confirmar'];
const START_HOUR = 8;
const END_HOUR = 20;

interface FormData {
  customerId: string;
  serviceId: string;
  professionalId: string;
  resourceId: string;
  date: Date;
  selectedSlot: string;
  notes: string;
  newCustomerName: string;
  newCustomerEmail: string;
  newCustomerPhone: string;
}

const defaultForm: FormData = {
  customerId: '',
  serviceId: '',
  professionalId: '',
  resourceId: '',
  date: new Date(),
  selectedSlot: '',
  notes: '',
  newCustomerName: '',
  newCustomerEmail: '',
  newCustomerPhone: '',
};

export default function NewAppointmentPage() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // --- Queries ---
  const { data: services = [] } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => getServices(business!.id),
    enabled: !!business?.id,
    select: (res) => (res.data ?? []).filter((s) => s.is_active),
  });

  const { data: allProfessionals = [] } = useQuery({
    queryKey: ['professionals', business?.id],
    queryFn: () => getProfessionals(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const customerResults = useQuery({
    queryKey: ['customers-search', business?.id, customerSearch],
    queryFn: () => searchCustomers(business!.id, customerSearch),
    enabled: !!business?.id && customerSearch.length >= 2 && !showNewCustomer,
    select: (res) => res.data ?? [],
  });

  const selectedService = useMemo(
    () => services.find((s) => s.id === form.serviceId),
    [services, form.serviceId]
  );

  const professionalOptions = useMemo(() => {
    if (!form.serviceId) return allProfessionals.filter((p) => p.is_active);
    return allProfessionals.filter((p) => p.is_active);
  }, [allProfessionals, form.serviceId]);

  const { data: availableSlots = [], isLoading: slotsLoading } = useQuery({
    queryKey: [
      'available-slots',
      business?.id,
      form.serviceId,
      form.professionalId,
      format(form.date, 'yyyy-MM-dd'),
    ],
    queryFn: () =>
      getAvailableSlots(
        business!.id,
        form.serviceId,
        form.professionalId,
        format(form.date, 'yyyy-MM-dd')
      ),
    enabled:
      !!business?.id &&
      !!form.serviceId &&
      !!form.professionalId &&
      step === 4,
    select: (res) => res.data ?? [],
  });

  // --- Mutations ---
  const createCustomerMut = useMutation({
    mutationFn: async () => {
      const res = await createCustomer({
        business_id: business!.id,
        full_name: form.newCustomerName,
        email: form.newCustomerEmail || null,
        phone: form.newCustomerPhone || null,
        notes: null,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
    onSuccess: (customer) => {
      setForm((prev) => ({ ...prev, customerId: customer.id }));
      setShowNewCustomer(false);
      toast.success('Cliente creado');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al crear cliente'),
  });

  const createAppointmentMut = useMutation({
    mutationFn: () => {
      const slotDate = format(form.date, 'yyyy-MM-dd');
      const startTime = `${slotDate}T${form.selectedSlot}:00`;
      const endMinutes =
        parseInt(form.selectedSlot.split(':')[0]) * 60 +
        parseInt(form.selectedSlot.split(':')[1]) +
        (selectedService?.duration_minutes ?? 30);
      const endTime = `${slotDate}T${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`;

      return createAppointment({
        business_id: business!.id,
        branch_id: selectedService?.branch_id ?? null,
        customer_id: form.customerId,
        professional_id: form.professionalId,
        service_id: form.serviceId,
        resource_id: form.resourceId || null,
        start_time: startTime,
        end_time: endTime,
        status: 'pending',
        payment_status: 'pending',
        payment_amount: selectedService?.price ?? null,
        payment_provider: null,
        notes: form.notes || null,
        internal_notes: null,
        cancelled_at: null,
        cancellation_reason: null,
        completed_at: null,
      }).then((res) => {
        if (res.error) throw new Error(res.error.message);
        return res.data;
      });
    },
    onSuccess: () => {
      toast.success('Turno creado exitosamente');
      navigate('/reservas');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al crear turno'),
  });

  // --- Handlers ---
  const canNext = useCallback(() => {
    switch (step) {
      case 0:
        return !!form.customerId;
      case 1:
        return !!form.serviceId;
      case 2:
        return !!form.professionalId;
      case 3:
        return !!form.date;
      case 4:
        return !!form.selectedSlot;
      default:
        return true;
    }
  }, [step, form]);

  const handleNext = () => {
    if (step === STEPS.length - 1) {
      createAppointmentMut.mutate();
    } else if (step === 4 && !form.selectedSlot) {
      toast.error('Seleccioná un horario');
    } else {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleCreateCustomer = () => {
    if (!form.newCustomerName.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    createCustomerMut.mutate();
  };

  const selectCustomer = (c: Customer) => {
    setForm((prev) => ({ ...prev, customerId: c.id }));
    setCustomerSearch('');
  };

  const selectedCustomer = useMemo(() => {
    if (!form.customerId) return null;
    return customerResults.data?.find((c) => c.id === form.customerId) ?? null;
  }, [form.customerId, customerResults.data]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const formatSlotTime = (slot: string) => {
    const [h, m] = slot.split(':');
    return `${h}:${m}`;
  };

  const formatSlotEnd = (slot: string, duration: number) => {
    const [h, m] = slot.split(':').map(Number);
    const total = h * 60 + m + duration;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  // --- Render Steps ---
  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Seleccionar cliente</h3>
            {!showNewCustomer ? (
              <>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Buscar por nombre, email o teléfono..."
                      className="w-full rounded-lg border border-[#333] bg-[#1A1A1A] text-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    icon={<UserPlus size={16} />}
                    onClick={() => setShowNewCustomer(true)}
                  >
                    Nuevo
                  </Button>
                </div>
                {customerResults.isLoading && customerSearch.length >= 2 && (
                  <LoadingSpinner size="sm" />
                )}
                {customerResults.data && customerResults.data.length > 0 && (
                  <div className="border border-[#333] rounded-lg divide-y divide-[#333] max-h-64 overflow-y-auto">
                    {customerResults.data.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className={`w-full text-left px-4 py-3 hover:bg-[#222] transition-colors ${
                          form.customerId === c.id ? 'bg-[#DC2626]/10 border-l-2 border-[#DC2626]' : ''
                        }`}
                      >
                        <div className="text-white font-medium text-sm">{c.full_name}</div>
                        <div className="text-[#9CA3AF] text-xs mt-0.5">
                          {c.email && <span>{c.email}</span>}
                          {c.email && c.phone && <span> · </span>}
                          {c.phone && <span>{c.phone}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {customerSearch.length >= 2 &&
                  customerResults.data &&
                  customerResults.data.length === 0 && (
                    <p className="text-sm text-[#9CA3AF] text-center py-4">
                      No se encontraron clientes. Creá uno nuevo.
                    </p>
                  )}
                {selectedCustomer && (
                  <div className="rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 p-4">
                    <p className="text-sm text-white font-medium">
                      Seleccionado: {selectedCustomer.full_name}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3 border border-[#333] rounded-lg p-4">
                <Input
                  label="Nombre completo"
                  value={form.newCustomerName}
                  onChange={(e) => setForm({ ...form, newCustomerName: e.target.value })}
                  placeholder="Ej: María López"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Email"
                    type="email"
                    value={form.newCustomerEmail}
                    onChange={(e) => setForm({ ...form, newCustomerEmail: e.target.value })}
                    placeholder="maria@email.com"
                  />
                  <Input
                    label="Teléfono"
                    value={form.newCustomerPhone}
                    onChange={(e) => setForm({ ...form, newCustomerPhone: e.target.value })}
                    placeholder="+54 11 1234-5678"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" onClick={() => setShowNewCustomer(false)}>
                    Cancelar
                  </Button>
                  <Button
                    loading={createCustomerMut.isPending}
                    onClick={handleCreateCustomer}
                  >
                    Crear cliente
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Seleccionar servicio</h3>
            {services.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] text-center py-8">
                No hay servicios disponibles.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setForm({ ...form, serviceId: s.id })}
                    className={`text-left rounded-lg border p-4 transition-all ${
                      form.serviceId === s.id
                        ? 'border-[#DC2626] bg-[#DC2626]/10 ring-1 ring-[#DC2626]/50'
                        : 'border-[#333] bg-[#1A1A1A] hover:border-[#555]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-white font-medium text-sm">{s.name}</div>
                        <div className="text-[#9CA3AF] text-xs mt-1 flex items-center gap-1">
                          <Clock size={12} /> {s.duration_minutes} min
                        </div>
                      </div>
                      <div className="text-white font-semibold text-sm">
                        ${s.price.toFixed(2)}
                      </div>
                    </div>
                    {s.description && (
                      <p className="text-[#9CA3AF] text-xs mt-2 line-clamp-2">
                        {s.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Seleccionar profesional</h3>
            {professionalOptions.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] text-center py-8">
                No hay profesionales disponibles.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {professionalOptions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setForm({ ...form, professionalId: p.id })}
                    className={`text-left rounded-lg border p-4 transition-all ${
                      form.professionalId === p.id
                        ? 'border-[#DC2626] bg-[#DC2626]/10 ring-1 ring-[#DC2626]/50'
                        : 'border-[#333] bg-[#1A1A1A] hover:border-[#555]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#DC2626] flex items-center justify-center text-white font-semibold text-sm shrink-0">
                        {p.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{p.full_name}</div>
                        {p.email && (
                          <div className="text-[#9CA3AF] text-xs">{p.email}</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Seleccionar fecha</h3>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeekStart(subWeeks(weekStart, 1))}
              >
                <ArrowLeft size={16} />
              </Button>
              <span className="text-white text-sm font-medium">
                {format(weekStart, 'MMMM yyyy', { locale: es })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeekStart(addWeeks(weekStart, 1))}
              >
                <ArrowRight size={16} />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => (
                <button
                  key={day.toISOString()}
                  onClick={() => setForm({ ...form, date: day })}
                  className={`flex flex-col items-center rounded-lg border p-3 transition-all ${
                    isSameDay(day, form.date)
                      ? 'border-[#DC2626] bg-[#DC2626]/10'
                      : 'border-[#333] bg-[#1A1A1A] hover:border-[#555]'
                  }`}
                >
                  <span className="text-[#9CA3AF] text-xs uppercase">
                    {format(day, 'EEE', { locale: es })}
                  </span>
                  <span className="text-white font-semibold text-lg">
                    {format(day, 'd')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Seleccionar horario</h3>
              <span className="text-sm text-[#9CA3AF]">
                {format(form.date, 'EEEE d MMMM', { locale: es })}
              </span>
            </div>
            {slotsLoading ? (
              <LoadingSpinner size="sm" />
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle size={32} className="mx-auto text-amber-400 mb-3" />
                <p className="text-sm text-[#9CA3AF]">
                  No hay horarios disponibles para esta fecha y profesional.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setForm({ ...form, selectedSlot: slot })}
                    className={`rounded-lg border p-3 text-center transition-all ${
                      form.selectedSlot === slot
                        ? 'border-[#DC2626] bg-[#DC2626]/10 ring-1 ring-[#DC2626]/50'
                        : 'border-[#333] bg-[#1A1A1A] hover:border-[#555]'
                    }`}
                  >
                    <div className="text-white font-medium text-sm">{formatSlotTime(slot)}</div>
                    {selectedService && (
                      <div className="text-[#9CA3AF] text-xs">
                        hasta {formatSlotEnd(slot, selectedService.duration_minutes)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Confirmar turno</h3>
            <div className="space-y-3">
              <div className="rounded-lg border border-[#333] bg-[#1A1A1A] p-4">
                <div className="text-xs text-[#9CA3AF] mb-1">Cliente</div>
                <div className="text-white font-medium">
                  {selectedCustomer?.full_name ?? '—'}
                </div>
              </div>
              <div className="rounded-lg border border-[#333] bg-[#1A1A1A] p-4">
                <div className="text-xs text-[#9CA3AF] mb-1">Servicio</div>
                <div className="text-white font-medium">
                  {selectedService?.name ?? '—'}
                </div>
                <div className="text-[#9CA3AF] text-xs mt-1">
                  {selectedService?.duration_minutes} min · ${selectedService?.price.toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg border border-[#333] bg-[#1A1A1A] p-4">
                <div className="text-xs text-[#9CA3AF] mb-1">Profesional</div>
                <div className="text-white font-medium">
                  {professionalOptions.find((p) => p.id === form.professionalId)?.full_name ?? '—'}
                </div>
              </div>
              <div className="rounded-lg border border-[#333] bg-[#1A1A1A] p-4">
                <div className="text-xs text-[#9CA3AF] mb-1">Fecha y hora</div>
                <div className="text-white font-medium">
                  {format(form.date, 'EEEE d MMMM yyyy', { locale: es })}
                </div>
                <div className="text-[#9CA3AF] text-xs mt-1">
                  {form.selectedSlot} - {selectedService && formatSlotEnd(form.selectedSlot, selectedService.duration_minutes)}
                </div>
              </div>
              <Textarea
                label="Notas (opcional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas sobre el turno..."
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          icon={<ArrowLeft size={18} />}
          onClick={() => navigate(-1)}
        >
          Volver
        </Button>
        <h1 className="text-2xl font-bold text-white">Nueva reserva</h1>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                i === step
                  ? 'bg-[#DC2626] text-white'
                  : i < step
                  ? 'bg-[#DC2626]/20 text-[#DC2626]'
                  : 'bg-[#1A1A1A] text-[#9CA3AF] border border-[#333]'
              }`}
            >
              {i < step ? (
                <Check size={14} />
              ) : (
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">
                  {i + 1}
                </span>
              )}
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="w-6 h-px bg-[#333] mx-1 shrink-0" />
            )}
          </div>
        ))}
      </div>

      <Card padding="lg">{renderStepContent()}</Card>

      <div className="flex justify-between">
        <Button
          variant="secondary"
          icon={<ArrowLeft size={16} />}
          onClick={handleBack}
          disabled={step === 0}
        >
          Anterior
        </Button>
        <Button
          icon={step === STEPS.length - 1 ? <Check size={16} /> : <ArrowRight size={16} />}
          onClick={handleNext}
          disabled={!canNext() || createAppointmentMut.isPending}
          loading={createAppointmentMut.isPending}
        >
          {step === STEPS.length - 1 ? 'Confirmar turno' : 'Siguiente'}
        </Button>
      </div>
    </div>
  );
}
