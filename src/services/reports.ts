import { supabase } from '@/lib/supabase';

interface ServiceError {
  message: string;
}

interface DateRange {
  startDate: string;
  endDate: string;
}

interface AppointmentStats {
  total: number;
  completed: number;
  cancelled: number;
  no_show: number;
  pending: number;
  confirmed: number;
  in_progress: number;
  completion_rate: number;
}

interface RevenueStats {
  total_revenue: number;
  average_per_appointment: number;
  total_appointments: number;
  paid_count: number;
  pending_count: number;
}

interface TopService {
  service_id: string;
  service_name: string;
  appointment_count: number;
  total_revenue: number;
}

interface TopProfessional {
  professional_id: string;
  professional_name: string;
  appointment_count: number;
  total_revenue: number;
  completion_rate: number;
}

export async function getAppointmentStats(
  businessId: string,
  dateRange: DateRange
): Promise<{ data: AppointmentStats | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id,status,payment_amount')
    .eq('business_id', businessId)
    .gte('start_time', dateRange.startDate)
    .lte('end_time', dateRange.endDate);

  if (error) return { data: null, error: { message: error.message } };

  const total = data?.length ?? 0;
  const completed = data?.filter((a) => a.status === 'completed').length ?? 0;
  const cancelled = data?.filter((a) => a.status === 'cancelled').length ?? 0;
  const no_show = data?.filter((a) => a.status === 'no_show').length ?? 0;
  const pending = data?.filter((a) => a.status === 'pending').length ?? 0;
  const confirmed = data?.filter((a) => a.status === 'confirmed').length ?? 0;
  const in_progress = data?.filter((a) => a.status === 'in_progress').length ?? 0;

  return {
    data: {
      total,
      completed,
      cancelled,
      no_show,
      pending,
      confirmed,
      in_progress,
      completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
    error: null,
  };
}

export async function getRevenueStats(
  businessId: string,
  dateRange: DateRange
): Promise<{ data: RevenueStats | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id,payment_amount,payment_status')
    .eq('business_id', businessId)
    .gte('start_time', dateRange.startDate)
    .lte('end_time', dateRange.endDate)
    .in('status', ['completed', 'in_progress']);

  if (error) return { data: null, error: { message: error.message } };

  const totalRevenue = data?.reduce((sum, a) => sum + (a.payment_amount ?? 0), 0) ?? 0;
  const totalAppointments = data?.length ?? 0;
  const paidCount = data?.filter((a) => a.payment_status === 'paid').length ?? 0;
  const pendingCount = data?.filter((a) => a.payment_status === 'pending').length ?? 0;

  return {
    data: {
      total_revenue: totalRevenue,
      average_per_appointment: totalAppointments > 0
        ? Math.round(totalRevenue / totalAppointments)
        : 0,
      total_appointments: totalAppointments,
      paid_count: paidCount,
      pending_count: pendingCount,
    },
    error: null,
  };
}

export async function getTopServices(
  businessId: string
): Promise<{ data: TopService[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('appointments')
    .select('service_id,services(name),payment_amount')
    .eq('business_id', businessId)
    .in('status', ['completed', 'in_progress']);

  if (error) return { data: null, error: { message: error.message } };

  const grouped = new Map<string, TopService>();

  data?.forEach((row) => {
    const serviceId = row.service_id;
    const serviceName = (row.services as unknown as { name: string } | null)?.name ?? 'Desconocido';
    const existing = grouped.get(serviceId);

    if (existing) {
      existing.appointment_count += 1;
      existing.total_revenue += row.payment_amount ?? 0;
    } else {
      grouped.set(serviceId, {
        service_id: serviceId,
        service_name: serviceName,
        appointment_count: 1,
        total_revenue: row.payment_amount ?? 0,
      });
    }
  });

  const topServices = Array.from(grouped.values())
    .sort((a, b) => b.appointment_count - a.appointment_count)
    .slice(0, 10);

  return { data: topServices, error: null };
}

export async function getTopProfessionals(
  businessId: string
): Promise<{ data: TopProfessional[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('appointments')
    .select('professional_id,professionals(full_name),status,payment_amount')
    .eq('business_id', businessId)
    .in('status', ['completed', 'in_progress', 'no_show']);

  if (error) return { data: null, error: { message: error.message } };

  const grouped = new Map<string, TopProfessional>();

  data?.forEach((row) => {
    const profId = row.professional_id;
    const profName = (row.professionals as unknown as { full_name: string } | null)?.full_name ?? 'Desconocido';
    const existing = grouped.get(profId);

    if (existing) {
      existing.appointment_count += 1;
      existing.total_revenue += row.payment_amount ?? 0;
    } else {
      grouped.set(profId, {
        professional_id: profId,
        professional_name: profName,
        appointment_count: 1,
        total_revenue: row.payment_amount ?? 0,
        completion_rate: 0,
      });
    }
  });

  // Calculate completion rates
  const { data: completedData } = await supabase
    .from('appointments')
    .select('professional_id,status')
    .eq('business_id', businessId)
    .in('status', ['completed', 'no_show']);

  if (completedData) {
    const completedCounts = new Map<string, { completed: number; total: number }>();

    completedData.forEach((row) => {
      const existing = completedCounts.get(row.professional_id) ?? { completed: 0, total: 0 };
      existing.total += 1;
      if (row.status === 'completed') existing.completed += 1;
      completedCounts.set(row.professional_id, existing);
    });

    grouped.forEach((prof) => {
      const counts = completedCounts.get(prof.professional_id);
      if (counts && counts.total > 0) {
        prof.completion_rate = Math.round((counts.completed / counts.total) * 100);
      }
    });
  }

  const topProfessionals = Array.from(grouped.values())
    .sort((a, b) => b.appointment_count - a.appointment_count)
    .slice(0, 10);

  return { data: topProfessionals, error: null };
}
