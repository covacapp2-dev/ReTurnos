import { supabase } from '@/lib/supabase';

// Notificaciones in-app de la campanita del Topbar (RLS: cada uno ve las suyas)
export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return [];
  return data ?? [];
}

export async function markAllAsRead(userId: string): Promise<void> {
  await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
}

export async function markAsRead(id: string): Promise<void> {
  await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
}
