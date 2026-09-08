import { supabase } from '@/lib/supabase';
import type { Customer } from '@/types';

interface ServiceError {
  message: string;
}

type CustomerInsert = Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'total_appointments' | 'last_appointment_at'>;
type CustomerUpdate = Partial<Omit<Customer, 'id' | 'created_at' | 'updated_at'>>;

export async function getCustomers(
  businessId: string
): Promise<{ data: Customer[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .order('full_name');

  return { data, error: error ? { message: error.message } : null };
}

export async function getCustomer(
  customerId: string
): Promise<{ data: Customer | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  return { data, error: error ? { message: error.message } : null };
}

export async function createCustomer(
  data: CustomerInsert
): Promise<{ data: Customer | null; error: ServiceError | null }> {
  const { data: newCustomer, error } = await supabase
    .from('customers')
    .insert(data)
    .select()
    .single();

  return { data: newCustomer, error: error ? { message: error.message } : null };
}

export async function updateCustomer(
  customerId: string,
  data: CustomerUpdate
): Promise<{ data: Customer | null; error: ServiceError | null }> {
  const { data: updated, error } = await supabase
    .from('customers')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', customerId)
    .select()
    .single();

  return { data: updated, error: error ? { message: error.message } : null };
}

export async function deleteCustomer(
  customerId: string
): Promise<{ error: ServiceError | null }> {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId);

  return { error: error ? { message: error.message } : null };
}

export async function searchCustomers(
  businessId: string,
  query: string
): Promise<{ data: Customer[] | null; error: ServiceError | null }> {
  const searchTerm = `%${query}%`;

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`)
    .order('full_name')
    .limit(20);

  return { data, error: error ? { message: error.message } : null };
}

export async function getCustomerByPhone(
  businessId: string,
  phone: string
): Promise<{ data: Customer | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .eq('phone', phone)
    .single();

  return {
    data,
    error: error?.code === 'PGRST116' ? null : error ? { message: error.message } : null,
  };
}
