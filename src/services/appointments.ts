import { supabase } from '@/lib/supabase';
import type {
  Appointment,
  AppointmentStatus,
  Service,
  Professional,
  Availability,
  BlockedDate,
} from '@/types';
import { parseISO, format, addMinutes, isWithinInterval } from 'date-fns';

interface ServiceError {
  message: string;
}

type AppointmentInsert = Omit<Appointment, 'id' | 'created_at' | 'updated_at'>;
type AppointmentUpdate = Partial<Omit<Appointment, 'id' | 'created_at' | 'updated_at'>>;

interface AppointmentFilters {
  status?: AppointmentStatus;
  professionalId?: string;
  startDate?: string;
  endDate?: string;
  customerId?: string;
}

// --- CRUD ---

export async function getAppointments(
  businessId: string,
  filters?: AppointmentFilters
): Promise<{ data: Appointment[] | null; error: ServiceError | null }> {
  let query = supabase
    .from('appointments')
    .select('*')
    .eq('business_id', businessId)
    .order('start_time');

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.professionalId) query = query.eq('professional_id', filters.professionalId);
  if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters?.startDate) query = query.gte('start_time', filters.startDate);
  if (filters?.endDate) query = query.lte('end_time', filters.endDate);

  const { data, error } = await query;

  return { data, error: error ? { message: error.message } : null };
}

export async function getAppointment(
  appointmentId: string
): Promise<{ data: Appointment | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single();

  return { data, error: error ? { message: error.message } : null };
}

export async function createAppointment(
  data: AppointmentInsert
): Promise<{ data: Appointment | null; error: ServiceError | null }> {
  const availabilityCheck = await checkAvailability(
    data.business_id,
    data.professional_id,
    data.resource_id,
    data.start_time,
    data.end_time
  );

  if (availabilityCheck.error) {
    return { data: null, error: availabilityCheck.error };
  }

  if (!availabilityCheck.data?.available) {
    return {
      data: null,
      error: { message: availabilityCheck.data?.reason ?? 'Horario no disponible' },
    };
  }

  const { data: newAppointment, error } = await supabase
    .from('appointments')
    .insert(data)
    .select()
    .single();

  return { data: newAppointment, error: error ? { message: error.message } : null };
}

export async function updateAppointment(
  appointmentId: string,
  data: AppointmentUpdate
): Promise<{ data: Appointment | null; error: ServiceError | null }> {
  if (data.start_time || data.end_time) {
    const existing = await getAppointment(appointmentId);
    if (!existing.data) return { data: null, error: { message: 'Cita no encontrada' } };

    const startTime = data.start_time ?? existing.data.start_time;
    const endTime = data.end_time ?? existing.data.end_time;
    const professionalId = data.professional_id ?? existing.data.professional_id;
    const resourceId = data.resource_id ?? existing.data.resource_id;

    const availabilityCheck = await checkAvailability(
      existing.data.business_id,
      professionalId,
      resourceId,
      startTime,
      endTime,
      appointmentId
    );

    if (availabilityCheck.error) {
      return { data: null, error: availabilityCheck.error };
    }

    if (!availabilityCheck.data?.available) {
      return {
        data: null,
        error: { message: availabilityCheck.data?.reason ?? 'Horario no disponible' },
      };
    }
  }

  const { data: updated, error } = await supabase
    .from('appointments')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .select()
    .single();

  return { data: updated, error: error ? { message: error.message } : null };
}

export async function cancelAppointment(
  appointmentId: string,
  reason?: string
): Promise<{ data: Appointment | null; error: ServiceError | null }> {
  const { data: updated, error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .select()
    .single();

  return { data: updated, error: error ? { message: error.message } : null };
}

export async function completeAppointment(
  appointmentId: string
): Promise<{ data: Appointment | null; error: ServiceError | null }> {
  const { data: updated, error } = await supabase
    .from('appointments')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .select()
    .single();

  return { data: updated, error: error ? { message: error.message } : null };
}

// --- Availability Check ---

export async function checkAvailability(
  businessId: string,
  professionalId: string,
  resourceId: string | null,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: string
): Promise<{
  data: { available: boolean; reason?: string } | null;
  error: ServiceError | null;
}> {
  const startDate = parseISO(startTime);
  const endDate = parseISO(endTime);
  const dayOfWeek = startDate.getDay();

  // 1. Check professional availability schedule
  const { data: availability, error: availError } = await supabase
    .from('availability')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true);

  if (availError) return { data: null, error: { message: availError.message } };

  const requestedStart = format(startDate, 'HH:mm');
  const requestedEnd = format(endDate, 'HH:mm');

  const isWithinSchedule = availability?.some(
    (a: Availability) => a.start_time <= requestedStart && a.end_time >= requestedEnd
  );

  if (!isWithinSchedule) {
    return {
      data: { available: false, reason: 'El profesional no tiene disponibilidad en este horario' },
      error: null,
    };
  }

  // 2. Check blocked dates
  const { data: blocked, error: blockedError } = await supabase
    .from('blocked_dates')
    .select('*')
    .eq('professional_id', professionalId)
    .lte('start_time', endTime)
    .gte('end_time', startTime);

  if (blockedError) return { data: null, error: { message: blockedError.message } };

  if (blocked && blocked.length > 0) {
    return {
      data: { available: false, reason: 'El profesional tiene un bloqueo en este horario' },
      error: null,
    };
  }

  // 3. Check existing appointments
  let conflictQuery = supabase
    .from('appointments')
    .select('id')
    .eq('professional_id', professionalId)
    .not('status', 'in', '("cancelled","no_show")')
    .lt('start_time', endTime)
    .gt('end_time', startTime);

  if (excludeAppointmentId) {
    conflictQuery = conflictQuery.neq('id', excludeAppointmentId);
  }

  const { data: conflicts, error: conflictError } = await conflictQuery;

  if (conflictError) return { data: null, error: { message: conflictError.message } };

  if (conflicts && conflicts.length > 0) {
    return {
      data: { available: false, reason: 'El profesional ya tiene una cita en este horario' },
      error: null,
    };
  }

  // 4. Check resource availability if specified
  if (resourceId) {
    let resourceQuery = supabase
      .from('appointments')
      .select('id')
      .eq('resource_id', resourceId)
      .not('status', 'in', '("cancelled","no_show")')
      .lt('start_time', endTime)
      .gt('end_time', startTime);

    if (excludeAppointmentId) {
      resourceQuery = resourceQuery.neq('id', excludeAppointmentId);
    }

    const { data: resourceConflicts, error: resourceError } = await resourceQuery;

    if (resourceError) return { data: null, error: { message: resourceError.message } };

    if (resourceConflicts && resourceConflicts.length > 0) {
      return {
        data: { available: false, reason: 'El recurso ya está reservado en este horario' },
        error: null,
      };
    }
  }

  return { data: { available: true }, error: null };
}

// --- Available Slots ---

export async function getAvailableSlots(
  businessId: string,
  serviceId: string,
  professionalId: string,
  date: string
): Promise<{ data: string[] | null; error: ServiceError | null }> {
  // Get service duration
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', serviceId)
    .single();

  if (serviceError || !service) {
    return { data: null, error: { message: serviceError?.message ?? 'Servicio no encontrado' } };
  }

  const targetDate = parseISO(date);
  const dayOfWeek = targetDate.getDay();

  // Get availability for the day
  const { data: availability, error: availError } = await supabase
    .from('availability')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true);

  if (availError) return { data: null, error: { message: availError.message } };

  if (!availability || availability.length === 0) {
    return { data: [], error: null };
  }

  // Get all appointments for the day
  const dayStart = format(targetDate, "yyyy-MM-dd'T'00:00:00");
  const dayEnd = format(targetDate, "yyyy-MM-dd'T'23:59:59");

  const { data: appointments, error: apptError } = await supabase
    .from('appointments')
    .select('start_time,end_time')
    .eq('professional_id', professionalId)
    .not('status', 'in', '("cancelled","no_show")')
    .gte('start_time', dayStart)
    .lte('end_time', dayEnd);

  if (apptError) return { data: null, error: { message: apptError.message } };

  // Get blocked dates for the day
  const { data: blocked } = await supabase
    .from('blocked_dates')
    .select('start_time,end_time')
    .eq('professional_id', professionalId)
    .lte('start_time', dayEnd)
    .gte('end_time', dayStart);

  // Generate slots
  const slots: string[] = [];
  const duration = service.duration_minutes;

  for (const avail of availability) {
    const [startHour, startMin] = avail.start_time.split(':').map(Number);
    const [endHour, endMin] = avail.end_time.split(':').map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    while (currentMinutes + duration <= endMinutes) {
      const slotStart = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
      const slotEndMinutes = currentMinutes + duration;
      const slotEnd = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;

      const slotStartISO = `${date}T${slotStart}:00`;
      const slotEndISO = `${date}T${slotEnd}:00`;

      // Check if slot overlaps with existing appointments
      const hasConflict = appointments?.some(
        (appt) => appt.start_time < slotEndISO && appt.end_time > slotStartISO
      );

      // Check if slot overlaps with blocked dates
      const isBlocked = blocked?.some(
        (b) => b.start_time < slotEndISO && b.end_time > slotStartISO
      );

      if (!hasConflict && !isBlocked) {
        slots.push(slotStart);
      }

      currentMinutes += 30; // 30-minute interval slots
    }
  }

  return { data: slots, error: null };
}
