import { supabase } from '@/lib/supabase';
import type { Professional, ProfessionalService } from '@/types';

interface ServiceError {
  message: string;
}

type ProfessionalInsert = Omit<Professional, 'id' | 'created_at' | 'updated_at'>;
type ProfessionalUpdate = Partial<Omit<Professional, 'id' | 'created_at' | 'updated_at'>>;

export async function getProfessionals(
  businessId: string
): Promise<{ data: Professional[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .eq('business_id', businessId)
    .order('full_name');

  return { data, error: error ? { message: error.message } : null };
}

export async function getProfessional(
  professionalId: string
): Promise<{ data: Professional | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .eq('id', professionalId)
    .single();

  return { data, error: error ? { message: error.message } : null };
}

export async function createProfessional(
  data: ProfessionalInsert
): Promise<{ data: Professional | null; error: ServiceError | null }> {
  const { data: newProfessional, error } = await supabase
    .from('professionals')
    .insert(data)
    .select()
    .single();

  return { data: newProfessional, error: error ? { message: error.message } : null };
}

export async function updateProfessional(
  professionalId: string,
  data: ProfessionalUpdate
): Promise<{ data: Professional | null; error: ServiceError | null }> {
  const { data: updated, error } = await supabase
    .from('professionals')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', professionalId)
    .select()
    .single();

  return { data: updated, error: error ? { message: error.message } : null };
}

export async function deleteProfessional(
  professionalId: string
): Promise<{ error: ServiceError | null }> {
  const { error } = await supabase
    .from('professionals')
    .delete()
    .eq('id', professionalId);

  return { error: error ? { message: error.message } : null };
}

// --- Professional Services ---

export async function getProfessionalServices(
  professionalId: string
): Promise<{ data: ProfessionalService[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('professional_services')
    .select('*')
    .eq('professional_id', professionalId);

  return { data, error: error ? { message: error.message } : null };
}

export async function assignServiceToProfessional(
  data: Omit<ProfessionalService, 'id' | 'created_at'>
): Promise<{ data: ProfessionalService | null; error: ServiceError | null }> {
  const { data: assigned, error } = await supabase
    .from('professional_services')
    .insert(data)
    .select()
    .single();

  return { data: assigned, error: error ? { message: error.message } : null };
}

export async function removeServiceFromProfessional(
  professionalId: string,
  serviceId: string
): Promise<{ error: ServiceError | null }> {
  const { error } = await supabase
    .from('professional_services')
    .delete()
    .eq('professional_id', professionalId)
    .eq('service_id', serviceId);

  return { error: error ? { message: error.message } : null };
}

export async function getProfessionalsForService(
  serviceId: string
): Promise<{ data: Professional[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('professional_services')
    .select('professionals(*)')
    .eq('service_id', serviceId);

  const professionals = data?.map((row) => (row as unknown as { professionals: Professional }).professionals) ?? null;

  return { data: professionals, error: error ? { message: error.message } : null };
}
