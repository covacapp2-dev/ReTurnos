import { supabase } from '@/lib/supabase';
import type { Service } from '@/types';

interface ServiceError {
  message: string;
}

type ServiceInsert = Omit<Service, 'id' | 'created_at' | 'updated_at'>;
type ServiceUpdate = Partial<Omit<Service, 'id' | 'created_at' | 'updated_at'>>;

export async function getServices(
  businessId: string
): Promise<{ data: Service[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', businessId)
    .order('name');

  return { data, error: error ? { message: error.message } : null };
}

export async function getService(
  serviceId: string
): Promise<{ data: Service | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single();

  return { data, error: error ? { message: error.message } : null };
}

export async function createService(
  data: ServiceInsert
): Promise<{ data: Service | null; error: ServiceError | null }> {
  const { data: newService, error } = await supabase
    .from('services')
    .insert(data)
    .select()
    .single();

  return { data: newService, error: error ? { message: error.message } : null };
}

export async function updateService(
  serviceId: string,
  data: ServiceUpdate
): Promise<{ data: Service | null; error: ServiceError | null }> {
  const { data: updated, error } = await supabase
    .from('services')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', serviceId)
    .select()
    .single();

  return { data: updated, error: error ? { message: error.message } : null };
}

export async function deleteService(
  serviceId: string
): Promise<{ error: ServiceError | null }> {
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', serviceId);

  return { error: error ? { message: error.message } : null };
}
