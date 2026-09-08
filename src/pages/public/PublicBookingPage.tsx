import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, addDays, isSameDay, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { getBusinessBySlug } from '../../services/business';
import { getServices } from '../../services/services';
import { getProfessionalsForService, getProfessionals } from '../../services/professionals';
import { getAvailableSlots, createAppointment } from '../../services/appointments';
import { getCustomerByPhone, createCustomer } from '../../services/customers';
import type { Service, Professional } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const STEPS = ['Servicio', 'Profesional', 'Fecha', 'Hora', 'Datos', 'Confirmar'];

export default function PublicBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const {
    data: business,
    isLoading: businessLoading,
    error: businessError,
  } = useQuery({
    queryKey: ['business-slug', slug],
    queryFn: () => getBusinessBySlug(slug!),
    enabled: !!slug,
    select: (res) => res.data,
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => getServices(business!.id),
    enabled: !!business?.id,
    select: (res) => (res.data ?? []).filter((s) => s.is_active && s.allows_online_booking),
  });

  const { data: professionals = [], isLoading: professionalsLoading } = useQuery({
    queryKey: ['professionals-for-service', selectedService?.id],
    queryFn: () => getProfessionalsForService(selectedService!.id),
    enabled: !!selectedService?.id,
    select: (res) => (res.data ?? []).filter((p) => p.is_active),
  });

  const { data: allProfessionals = [] } = useQuery({
    queryKey: ['professionals', business?.id],
    queryFn: () => getProfessionals(business!.id),
    enabled: !!business?.id && step === 1 && professionals.length === 0,
    select: (res) => (res.data ?? []).filter((p) => p.is_active),
  });

  const displayProfessionals = professionals.length > 0 ? professionals : allProfessionals;
  const needsProfessionalStep = displayProfessionals.length > 0;

  const { data: availableSlots = [], isLoading: slotsLoading } = useQuery({
    queryKey: [
      'available-slots',
      business?.id,
      selectedService?.id,
      selectedProfessional?.id,
      format(selectedDate, 'yyyy-MM-dd'),
    ],
    queryFn: () =>
      getAvailableSlots(
        business!.id,
        selectedService!.id,
        selectedProfessional!.id,
        format(selectedDate, 'yyyy-MM-dd')
      ),
    enabled: !!business?.id && !!selectedService?.id && !!selectedProfessional?.id && step === 3,
    select: (res) => res.data ?? [],
  });

  const createCustomerMut = useMutation({
    mutationFn: async () => {
      const { data: existing } = await getCustomerByPhone(business!.id, customerPhone);
      if (existing) return existing;

      const res = await createCustomer({
        business_id: business!.id,
        full_name: customerName,
        email: customerEmail || null,
        phone: customerPhone,
        notes: null,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
    onSuccess: (customer) => createAppointmentMut.mutate(customer.id),
    onError: () => toast.error('Error al procesar tu información'),
  });

  const createAppointmentMut = useMutation({
    mutationFn: (customerId: string) => {
      const slotDate = format(selectedDate, 'yyyy-MM-dd');
      const startTime = `${slotDate}T${selectedSlot}:00`;
      const endMinutes =
        parseInt(selectedSlot.split(':')[0]) * 60 +
        parseInt(selectedSlot.split(':')[1]) +
        (selectedService?.duration_minutes ?? 30);
      const endTime = `${slotDate}T${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`;

      return createAppointment({
        business_id: business!.id,
        branch_id: selectedService?.branch_id ?? null,
        customer_id: customerId,
        professional_id: selectedProfessional!.id,
        service_id: selectedService!.id,
        resource_id: null,
        start_time: startTime,
        end_time: endTime,
        status: 'pending',
        payment_status: 'pending',
        payment_amount: selectedService?.price ?? null,
        payment_provider: null,
        notes: null,
        internal_notes: null,
        cancelled_at: null,
        cancellation_reason: null,
        completed_at: null,
      });
    },
    onSuccess: () => {
      navigate(
        `/reserva/${slug}/exito?servicio=${encodeURIComponent(selectedService?.name ?? '')}&profesional=${encodeURIComponent(selectedProfessional?.full_name ?? '')}&fecha=${format(selectedDate, 'yyyy-MM-dd')}&hora=${selectedSlot}`
      );
    },
    onError: () => toast.error('Error al crear la reserva'),
  });

  const nextStep = () => {
    if (step === 0 && !selectedService) {
      toast.error('Seleccioná un servicio');
      return;
    }
    if (step === 1 && needsProfessionalStep && !selectedProfessional) {
      toast.error('Seleccioná un profesional');
      return;
    }
    if (step === 3 && !selectedSlot) {
      toast.error('Seleccioná un horario');
      return;
    }
    if (step === 4) {
      if (!customerName.trim()) {
        toast.error('Ingresá tu nombre');
        return;
      }
      if (!customerPhone.trim()) {
        toast.error('Ingresá tu teléfono');
        return;
      }
    }
    if (step === STEPS.length - 1) {
      createCustomerMut.mutate();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const effectiveStep = needsProfessionalStep ? step : step + 1;
  const totalSteps = needsProfessionalStep ? STEPS.length : STEPS.length - 1;

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: Date[] = [];
    for (let i = 0; i < startPad; i++) {
      days.push(addDays(firstDay, -(startPad - i)));
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    while (days.length % 7 !== 0) {
      days.push(addDays(lastDay, days.length - startPad - lastDay.getDate() + 1));
    }
    return days;
  }, [calendarMonth]);

  const maxDate = addDays(new Date(), 30);

  if (businessLoading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (businessError || !business) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <p className="text-white text-xl font-semibold">Negocio no encontrado</p>
          <p className="text-[#9CA3AF] text-sm">El enlace no es válido o el negocio no existe.</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[#DC2626] hover:text-[#EF4444] text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Elegí tu servicio</h2>
            <p className="text-[#9CA3AF] text-sm">
              Seleccioná el servicio que querés reservar.
            </p>
            {servicesLoading ? (
              <LoadingSpinner size="sm" />
            ) : services.length === 0 ? (
              <p className="text-[#9CA3AF] text-center py-8">
                No hay servicios disponibles para reserva online.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedService(s)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      selectedService?.id === s.id
                        ? 'border-[#DC2626] bg-[#DC2626]/10 ring-1 ring-[#DC2626]/50'
                        : 'border-[#333] bg-[#1A1A1A] hover:border-[#555]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-white font-semibold text-sm">{s.name}</div>
                        <div className="text-[#9CA3AF] text-xs mt-1 flex items-center gap-1">
                          <Clock size={12} /> {s.duration_minutes} min
                        </div>
                      </div>
                      <div className="text-white font-bold text-sm">
                        ${s.price.toFixed(0)}
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

      case 1:
        if (!needsProfessionalStep) {
          return null;
        }
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Elegí tu profesional</h2>
            <p className="text-[#9CA3AF] text-sm">
              Seleccioná con quién querés tu turno.
            </p>
            {professionalsLoading ? (
              <LoadingSpinner size="sm" />
            ) : displayProfessionals.length === 0 ? (
              <p className="text-[#9CA3AF] text-center py-8">
                No hay profesionales disponibles.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayProfessionals.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfessional(p)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      selectedProfessional?.id === p.id
                        ? 'border-[#DC2626] bg-[#DC2626]/10 ring-1 ring-[#DC2626]/50'
                        : 'border-[#333] bg-[#1A1A1A] hover:border-[#555]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={p.full_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-[#DC2626] flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {p.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-white font-semibold text-sm">{p.full_name}</div>
                        {p.bio && (
                          <div className="text-[#9CA3AF] text-xs mt-0.5 line-clamp-1">{p.bio}</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Elegí la fecha</h2>
            <p className="text-[#9CA3AF] text-sm">
              Seleccioná el día para tu turno.
            </p>
            <div className="rounded-xl border border-[#333] bg-[#1A1A1A] p-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCalendarMonth(addDays(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1), -1))}
                  className="p-1.5 rounded-lg hover:bg-[#333] text-[#9CA3AF] hover:text-white transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-white font-semibold text-sm">
                  {format(calendarMonth, 'MMMM yyyy', { locale: es })}
                </span>
                <button
                  onClick={() => setCalendarMonth(addDays(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1), 0))}
                  className="p-1.5 rounded-lg hover:bg-[#333] text-[#9CA3AF] hover:text-white transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => (
                  <div key={d} className="text-center text-[#9CA3AF] text-xs font-medium py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, selectedDate);
                  const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
                  const isFuture = day > maxDate;
                  const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                  const isDisabled = isPast || isFuture || !isCurrentMonth;

                  return (
                    <button
                      key={i}
                      onClick={() => !isDisabled && setSelectedDate(day)}
                      disabled={isDisabled}
                      className={`relative rounded-lg p-2 text-center transition-all ${
                        isDisabled
                          ? 'opacity-30 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#DC2626] text-white'
                          : isToday
                          ? 'bg-[#DC2626]/20 text-[#DC2626] hover:bg-[#DC2626]/30'
                          : 'hover:bg-[#333] text-white'
                      }`}
                    >
                      <span className="text-sm font-medium">{format(day, 'd')}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-[#333] bg-[#1A1A1A] p-3 flex items-center gap-3">
              <Calendar size={18} className="text-[#DC2626] shrink-0" />
              <span className="text-white text-sm font-medium">
                {format(selectedDate, 'EEEE d MMMM yyyy', { locale: es })}
              </span>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Elegí el horario</h2>
                <p className="text-[#9CA3AF] text-sm mt-1">
                  Horarios disponibles para el {format(selectedDate, 'd MMMM', { locale: es })}
                </p>
              </div>
            </div>
            {slotsLoading ? (
              <LoadingSpinner size="sm" />
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8 rounded-xl border border-[#333] bg-[#1A1A1A]">
                <Clock size={32} className="mx-auto text-[#9CA3AF] mb-3" />
                <p className="text-[#9CA3AF] text-sm">
                  No hay horarios disponibles para esta fecha.
                </p>
                <button
                  onClick={prevStep}
                  className="mt-3 text-[#DC2626] text-sm font-medium hover:text-[#EF4444]"
                >
                  Elegir otra fecha
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableSlots.map((slot) => {
                  const [h, m] = slot.split(':').map(Number);
                  const endMin = h * 60 + m + (selectedService?.duration_minutes ?? 30);
                  const endStr = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

                  return (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-xl border p-3 text-center transition-all ${
                        selectedSlot === slot
                          ? 'border-[#DC2626] bg-[#DC2626]/10 ring-1 ring-[#DC2626]/50'
                          : 'border-[#333] bg-[#1A1A1A] hover:border-[#555]'
                      }`}
                    >
                      <div className="text-white font-semibold text-sm">{slot}</div>
                      <div className="text-[#9CA3AF] text-xs">hasta {endStr}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Tus datos</h2>
            <p className="text-[#9CA3AF] text-sm">
              Completá tu información para confirmar la reserva.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full rounded-xl border border-[#333] bg-[#1A1A1A] text-white placeholder:text-[#9CA3AF] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+54 11 1234-5678"
                  className="w-full rounded-xl border border-[#333] bg-[#1A1A1A] text-white placeholder:text-[#9CA3AF] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">
                  Email (opcional)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full rounded-xl border border-[#333] bg-[#1A1A1A] text-white placeholder:text-[#9CA3AF] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Confirmá tu reserva</h2>
            <p className="text-[#9CA3AF] text-sm">
              Revisá los datos antes de confirmar.
            </p>
            <div className="space-y-3">
              <div className="rounded-xl border border-[#333] bg-[#1A1A1A] p-4">
                <div className="text-xs text-[#9CA3AF] mb-1">Servicio</div>
                <div className="text-white font-semibold">{selectedService?.name}</div>
                <div className="text-[#9CA3AF] text-xs mt-1">
                  {selectedService?.duration_minutes} min · ${selectedService?.price.toFixed(0)}
                </div>
              </div>
              {selectedProfessional && (
                <div className="rounded-xl border border-[#333] bg-[#1A1A1A] p-4">
                  <div className="text-xs text-[#9CA3AF] mb-1">Profesional</div>
                  <div className="text-white font-semibold">{selectedProfessional.full_name}</div>
                </div>
              )}
              <div className="rounded-xl border border-[#333] bg-[#1A1A1A] p-4">
                <div className="text-xs text-[#9CA3AF] mb-1">Fecha y hora</div>
                <div className="text-white font-semibold">
                  {format(selectedDate, 'EEEE d MMMM yyyy', { locale: es })}
                </div>
                <div className="text-[#9CA3AF] text-xs mt-1">{selectedSlot} hs</div>
              </div>
              <div className="rounded-xl border border-[#333] bg-[#1A1A1A] p-4">
                <div className="text-xs text-[#9CA3AF] mb-1">Tus datos</div>
                <div className="text-white font-semibold">{customerName}</div>
                <div className="text-[#9CA3AF] text-xs mt-1">{customerPhone}</div>
                {customerEmail && (
                  <div className="text-[#9CA3AF] text-xs">{customerEmail}</div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#080808]">
      <div className="max-w-lg mx-auto px-4 py-6 min-h-screen flex flex-col">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            {business.logo_url ? (
              <img
                src={business.logo_url}
                alt={business.name}
                className="w-10 h-10 rounded-xl object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#DC2626] flex items-center justify-center text-white font-bold text-sm">
                {business.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">{business.name}</h1>
              {business.description && (
                <p className="text-[#9CA3AF] text-xs line-clamp-1">{business.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    i < effectiveStep
                      ? 'bg-[#DC2626]'
                      : i === effectiveStep
                      ? 'bg-[#DC2626]/50'
                      : 'bg-[#333]'
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[#9CA3AF] text-xs">
              Paso {effectiveStep + 1} de {totalSteps}
            </span>
            <span className="text-[#9CA3AF] text-xs">
              {STEPS[effectiveStep]}
            </span>
          </div>
        </div>

        <div className="flex-1">{renderStep()}</div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-[#333]">
          {step > 0 && (
            <button
              onClick={prevStep}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#333] bg-[#1A1A1A] text-[#9CA3AF] hover:text-white hover:border-[#555] transition-colors text-sm font-medium"
            >
              <ArrowLeft size={16} />
              Volver
            </button>
          )}
          <button
            onClick={nextStep}
            disabled={createCustomerMut.isPending || createAppointmentMut.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#DC2626] text-white hover:bg-[#B91C1C] active:bg-[#991B1B] transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createCustomerMut.isPending || createAppointmentMut.isPending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : step === STEPS.length - 1 ? (
              <>
                <Check size={16} />
                Confirmar reserva
              </>
            ) : (
              <>
                Siguiente
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        <div className="text-center mt-4 pb-4">
          <p className="text-[#9CA3AF] text-xs">
            Powered by{' '}
            <span className="text-[#DC2626] font-semibold">ReTurnos</span>
          </p>
        </div>
      </div>
    </div>
  );
}
