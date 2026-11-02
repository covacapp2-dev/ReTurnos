import { supabase } from '@/lib/supabase';
import type { Availability, BlockedDate } from '@/types';

interface ServiceError {
  message: string;
}

type AvailabilityInsert = Omit<Availability, 'id' | 'created_at' | 'updated_at'>;
type AvailabilityUpdate = Partial<Omit<Availability, 'id' | 'created_at' | 'updated_at'>>;
type BlockedDateInsert = Omit<BlockedDate, 'id' | 'created_at'>;

// --- Availability ---

export async function getAvailability(
  professionalId: string
): Promise<{ data: Availability[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('professional_id', professionalId)
    .order('day_of_week');

  return { data, error: error ? { message: error.message } : null };
}

export async function getAvailabilityForDay(
  professionalId: string,
  dayOfWeek: number
): Promise<{ data: Availability[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true);

  return { data, error: error ? { message: error.message } : null };
}

export async function createAvailability(
  data: AvailabilityInsert
): Promise<{ data: Availability | null; error: ServiceError | null }> {
  const { data: newAvailability, error } = await supabase
    .from('availability')
    .insert(data)
    .select()
    .single();

  return { data: newAvailability, error: error ? { message: error.message } : null };
}

export async function updateAvailability(
  availabilityId: string,
  data: AvailabilityUpdate
): Promise<{ data: Availability | null; error: ServiceError | null }> {
  const { data: updated, error } = await supabase
    .from('availability')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', availabilityId)
    .select()
    .single();

  return { data: updated, error: error ? { message: error.message } : null };
}

export async function deleteAvailability(
  availabilityId: string
): Promise<{ error: ServiceError | null }> {
  const { error } = await supabase
    .from('availability')
    .delete()
    .eq('id', availabilityId);

  return { error: error ? { message: error.message } : null };
}

export async function upsertAvailability(
  professionalId: string,
  slots: Omit<AvailabilityInsert, 'professional_id'>[]
): Promise<{ error: ServiceError | null }> {
  const existing = await supabase
    .from('availability')
    .delete()
    .eq('professional_id', professionalId);

  if (existing.error) return { error: { message: existing.error.message } };

  if (slots.length === 0) return { error: null };

  const { error } = await supabase
    .from('availability')
    .insert(slots.map((slot) => ({ ...slot, professional_id: professionalId })));

  return { error: error ? { message: error.message } : null };
}

// --- Blocked Dates ---

export async function getBlockedDates(
  professionalId: string
): Promise<{ data: BlockedDate[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('*')
    .eq('professional_id', professionalId)
    .order('start_time');

  return { data, error: error ? { message: error.message } : null };
}

export async function getBlockedDatesInRange(
  professionalId: string,
  startDate: string,
  endDate: string
): Promise<{ data: BlockedDate[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('*')
    .eq('professional_id', professionalId)
    .lte('start_time', endDate)
    .gte('end_time', startDate);

  return { data, error: error ? { message: error.message } : null };
}

export async function createBlockedDate(
  data: BlockedDateInsert
): Promise<{ data: BlockedDate | null; error: ServiceError | null }> {
  const { data: newBlocked, error } = await supabase
    .from('blocked_dates')
    .insert(data)
    .select()
    .single();

  return { data: newBlocked, error: error ? { message: error.message } : null };
}

export async function deleteBlockedDate(
  blockedDateId: string
): Promise<{ error: ServiceError | null }> {
  const { error } = await supabase
    .from('blocked_dates')
    .delete()
    .eq('id', blockedDateId);

  return { error: error ? { message: error.message } : null };
}
