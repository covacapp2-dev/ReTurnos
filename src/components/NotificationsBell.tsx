import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import {
  fetchNotifications,
  markAllAsRead,
  markAsRead,
  type AppNotification,
} from '../services/notifications';
import { cn } from '../lib/utils';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString('es-AR');
}

export default function NotificationsBell() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((i) => !i.read_at).length;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const list = await fetchNotifications(user.id);
    setItems(list);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || !user) return;

    setLoading(true);
    const list = await fetchNotifications(user.id);
    setItems(list);
    setLoading(false);

    if (list.some((i) => !i.read_at)) {
      await markAllAsRead(user.id);
      setItems(list.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    }
  }

  async function handleClick(item: AppNotification) {
    if (!item.read_at) {
      await markAsRead(item.id);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i))
      );
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={toggle}
        aria-label="Notificaciones"
        className="relative p-2 rounded-lg text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white transition-colors"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full',
              'bg-[#DC2626] text-white text-[10px] font-bold',
              'flex items-center justify-center'
            )}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[320px] sm:w-[360px] bg-[#1A1A1A] border border-[#333] rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
            <span className="text-sm font-semibold text-white">Notificaciones</span>
            {unread > 0 && (
              <button
                onClick={async () => {
                  if (!user) return;
                  await markAllAsRead(user.id);
                  setItems((prev) =>
                    prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() }))
                  );
                }}
                className="flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-white transition-colors"
              >
                <CheckCheck size={13} />
                Marcar leídas
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-[#9CA3AF]">Cargando…</p>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={26} className="mx-auto text-[#333] mb-2" />
                <p className="text-sm text-[#9CA3AF]">No tenés notificaciones</p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleClick(item)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-[#333]/50 last:border-0',
                    'hover:bg-[#222] transition-colors',
                    !item.read_at && 'bg-[#DC2626]/5'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!item.read_at && (
                      <span className="w-2 h-2 rounded-full bg-[#DC2626] mt-1.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{item.title}</p>
                      <p className="text-xs text-[#9CA3AF] mt-0.5 line-clamp-2">{item.message}</p>
                      <p className="text-[11px] text-[#666] mt-1">{timeAgo(item.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
