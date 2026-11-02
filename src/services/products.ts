import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';

interface ServiceError {
  message: string;
}

type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at'>;
type ProductUpdate = Partial<Omit<Product, 'id' | 'business_id' | 'created_at' | 'updated_at'>>;

export async function getProducts(
  businessId: string
): Promise<{ data: Product[] | null; error: ServiceError | null }> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .order('name');

  return { data, error: error ? { message: error.message } : null };
}

export async function createProduct(
  data: ProductInsert
): Promise<{ data: Product | null; error: ServiceError | null }> {
  const { data: newProduct, error } = await supabase
    .from('products')
    .insert(data)
    .select()
    .single();

  return { data: newProduct, error: error ? { message: error.message } : null };
}

export async function updateProduct(
  productId: string,
  data: ProductUpdate
): Promise<{ data: Product | null; error: ServiceError | null }> {
  const { data: updated, error } = await supabase
    .from('products')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select()
    .single();

  return { data: updated, error: error ? { message: error.message } : null };
}

export async function deleteProduct(
  productId: string
): Promise<{ error: ServiceError | null }> {
  const { error } = await supabase.from('products').delete().eq('id', productId);

  return { error: error ? { message: error.message } : null };
}

export async function searchProducts(
  businessId: string,
  term: string
): Promise<{ data: Product[] | null; error: ServiceError | null }> {
  const trimmed = term.trim();
  if (!trimmed) return getProducts(businessId);

  const escaped = trimmed.replace(/[,()]/g, ' ').trim();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .or(`name.ilike.%${escaped}%,barcode.ilike.%${escaped}%`)
    .order('name');

  return { data, error: error ? { message: error.message } : null };
}
