import { supabase } from '@/lib/supabase';
import type { Branch } from '@/types';

interface ServiceError {
  message: string;
}

type BranchInsert = Omit<Branch, 'id' | 'created_at' | 'updated_at'>;
type BranchUpdate = Partial<Omit<Branch, 'id' | 'created_at' | 'updated_at'>>;

export async function getBranches(
  businessId: string
): Promise<{ data: Branch[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('business_id', businessId)
    .order('name');

  return { data, error: error ? { message: error.message } : null };
}

export async function getBranch(
  branchId: string
): Promise<{ data: Branch | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('id', branchId)
    .single();

  return { data, error: error ? { message: error.message } : null };
}

export async function createBranch(
  data: BranchInsert
): Promise<{ data: Branch | null; error: ServiceError | null }> {
  const { data: newBranch, error } = await supabase
    .from('branches')
    .insert(data)
    .select()
    .single();

  return { data: newBranch, error: error ? { message: error.message } : null };
}

export async function updateBranch(
  branchId: string,
  data: BranchUpdate
): Promise<{ data: Branch | null; error: ServiceError | null }> {
  const { data: updated, error } = await supabase
    .from('branches')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', branchId)
    .select()
    .single();

  return { data: updated, error: error ? { message: error.message } : null };
}

export async function deleteBranch(
  branchId: string
): Promise<{ error: ServiceError | null }> {
  const { error } = await supabase
    .from('branches')
    .delete()
    .eq('id', branchId);

  return { error: error ? { message: error.message } : null };
}
