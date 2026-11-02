import { supabase } from '@/lib/supabase';
import type { Sale, SaleItem } from '@/types';

interface ServiceError {
  message: string;
}

export interface SaleItemInput {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export async function createSale(
  businessId: string,
  items: SaleItemInput[],
  notes?: string
): Promise<{ data: SaleWithItems | null; error: ServiceError | null }> {
  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  const { data: sale, error } = await supabase
    .from('sales')
    .insert({
      business_id: businessId,
      total,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return { data: null, error: { message: error.message } };

  const { data: saleItems, error: itemsError } = await supabase
    .from('sale_items')
    .insert(
      items.map((i) => ({
        sale_id: sale.id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        unit_cost: i.unit_cost,
      }))
    )
    .select();

  if (itemsError) {
    // No dejamos la venta sin items: intentamos limpiar
    await supabase.from('sales').delete().eq('id', sale.id);
    return { data: null, error: { message: itemsError.message } };
  }

  return { data: { ...sale, items: saleItems ?? [] }, error: null };
}

export async function getSales(
  businessId: string,
  options?: { from?: string; to?: string; limit?: number }
): Promise<{ data: SaleWithItems[] | null; error: ServiceError | null }> {
  let query = supabase
    .from('sales')
    .select('*, sale_items(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (options?.from) query = query.gte('created_at', options.from);
  if (options?.to) query = query.lte('created_at', options.to);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;

  return { data, error: error ? { message: error.message } : null };
}
