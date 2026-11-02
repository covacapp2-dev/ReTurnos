import { supabase } from '@/lib/supabase';
import type { Resource } from '@/types';

interface ServiceError {
  message: string;
}

// Las canchas son resources con type='room' y un deporte asignado.
export async function getCourts(
  businessId: string
): Promise<{ data: Resource[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('business_id', businessId)
    .eq('type', 'room')
    .order('name');

  return {
    data: (data ?? []).filter((r) => !!r.sport),
    error: error ? { message: error.message } : null,
  };
}

export async function createCourt(
  businessId: string,
  sport: string,
  name: string
): Promise<{ data: Resource | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('resources')
    .insert({
      business_id: businessId,
      branch_id: null,
      name: name.trim(),
      type: 'room',
      sport,
      description: null,
      is_active: true,
    })
    .select()
    .single();

  return { data, error: error ? { message: error.message } : null };
}

export async function updateCourt(
  courtId: string,
  data: { name?: string; is_active?: boolean }
): Promise<{ data: Resource | null; error: ServiceError | null }> {
  const { data: updated, error } = await supabase
    .from('resources')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', courtId)
    .select()
    .single();

  return { data: updated, error: error ? { message: error.message } : null };
}

export async function deleteCourt(
  courtId: string
): Promise<{ error: ServiceError | null }> {
  const { error } = await supabase.from('resources').delete().eq('id', courtId);

  return { error: error ? { message: error.message } : null };
}
