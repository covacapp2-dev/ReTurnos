import { supabase } from '@/lib/supabase';
import type { Business } from '@/types';

interface ServiceError {
  message: string;
}

type BusinessInsert = Omit<Business, 'id' | 'created_at' | 'updated_at'>;
type BusinessUpdate = Partial<Omit<Business, 'id' | 'created_at' | 'updated_at'>>;

export async function getBusiness(
  businessId: string
): Promise<{ data: Business | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  return { data, error: error ? { message: error.message } : null };
}

export async function getBusinessBySlug(
  slug: string
): Promise<{ data: Business | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', slug)
    .single();

  return { data, error: error ? { message: error.message } : null };
}

export async function createBusiness(
  data: BusinessInsert
): Promise<{ data: Business | null; error: ServiceError | null }> {
  const { data: newBusiness, error } = await supabase
    .from('businesses')
    .insert(data)
    .select()
    .single();

  return { data: newBusiness, error: error ? { message: error.message } : null };
}

export async function updateBusiness(
  businessId: string,
  data: BusinessUpdate
): Promise<{ data: Business | null; error: ServiceError | null }> {
  const { data: updated, error } = await supabase
    .from('businesses')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', businessId)
    .select()
    .single();

  return { data: updated, error: error ? { message: error.message } : null };
}

export async function getUserBusiness(): Promise<{
  data: Business | null;
  error: ServiceError | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { data: null, error: { message: 'Usuario no autenticado' } };

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  return { data, error: error ? { message: error.message } : null };
}
