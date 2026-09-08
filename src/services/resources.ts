import { supabase } from '@/lib/supabase';
import type { Resource } from '@/types';

interface ServiceError {
  message: string;
}

type ResourceInsert = Omit<Resource, 'id' | 'created_at' | 'updated_at'>;
type ResourceUpdate = Partial<Omit<Resource, 'id' | 'created_at' | 'updated_at'>>;

export async function getResources(
  businessId: string
): Promise<{ data: Resource[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('business_id', businessId)
    .order('name');

  return { data, error: error ? { message: error.message } : null };
}

export async function getResource(
  resourceId: string
): Promise<{ data: Resource | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('id', resourceId)
    .single();

  return { data, error: error ? { message: error.message } : null };
}

export async function createResource(
  data: ResourceInsert
): Promise<{ data: Resource | null; error: ServiceError | null }> {
  const { data: newResource, error } = await supabase
    .from('resources')
    .insert(data)
    .select()
    .single();

  return { data: newResource, error: error ? { message: error.message } : null };
}

export async function updateResource(
  resourceId: string,
  data: ResourceUpdate
): Promise<{ data: Resource | null; error: ServiceError | null }> {
  const { data: updated, error } = await supabase
    .from('resources')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', resourceId)
    .select()
    .single();

  return { data: updated, error: error ? { message: error.message } : null };
}

export async function deleteResource(
  resourceId: string
): Promise<{ error: ServiceError | null }> {
  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('id', resourceId);

  return { error: error ? { message: error.message } : null };
}
