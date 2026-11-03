import { supabase } from '@/lib/supabase';

// Única cuenta con acceso al panel de administración
export const ADMIN_EMAIL = 'covacapp2@gmail.com';

export function isAdminEmail(email?: string | null): boolean {
  return (email ?? '').toLowerCase() === ADMIN_EMAIL;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
  business_id: string | null;
  business_name: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
}

async function invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: { action, ...params },
  });

  if (error) {
    let message = 'No se pudo completar la operación';
    try {
      const ctx = (error as { context?: { body?: string } }).context;
      if (ctx?.body) {
        const parsed = JSON.parse(ctx.body);
        if (parsed?.error) message = parsed.error;
      }
    } catch {
      /* sin detalle */
    }
    throw new Error(message);
  }

  return data as T;
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const data = await invoke<{ users: AdminUserRow[] }>('list');
  return data.users ?? [];
}

export async function adminGrantForever(userId: string): Promise<void> {
  await invoke('grant_forever', { user_id: userId });
}

export async function adminDeleteUser(userId: string): Promise<void> {
  await invoke('delete_user', { user_id: userId });
}

export async function adminNotify(title: string, message: string): Promise<number> {
  const data = await invoke<{ sent: number }>('notify', { title, message });
  return data.sent ?? 0;
}
