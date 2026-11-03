import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  ShieldCheck,
  Gift,
  Trash2,
  RefreshCw,
  Search,
  Send,
  Inbox,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import {
  isAdminEmail,
  adminListUsers,
  adminGrantForever,
  adminDeleteUser,
  adminNotify,
  type AdminUserRow,
} from '../services/admin';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

function statusLabel(status: string | null): string {
  switch (status) {
    case 'active':
      return 'Activa';
    case 'trial':
      return 'Prueba';
    case 'past_due':
      return 'Impaga';
    case 'cancelled':
      return 'Cancelada';
    case 'expired':
      return 'Vencida';
    default:
      return 'Sin negocio';
  }
}

function statusVariant(status: string | null): 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'active':
      return 'success';
    case 'trial':
      return 'warning';
    case 'past_due':
    case 'expired':
    case 'cancelled':
      return 'danger';
    default:
      return 'info';
  }
}

export default function AdminPage() {
  const { user } = useAuth();
  const allowed = isAdminEmail(user?.email);

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [grantingId, setGrantingId] = useState<string | null>(null);

  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await adminListUsers());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (allowed) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.business_name ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const newUsers = useMemo(
    () => rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 24 * 3600 * 1000),
    [rows]
  );

  async function handleGrant(row: AdminUserRow) {
    setGrantingId(row.id);
    try {
      await adminGrantForever(row.id);
      toast.success(`${row.email} quedó gratis para siempre`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo otorgar el acceso');
    } finally {
      setGrantingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminDeleteUser(deleteTarget.id);
      toast.success(`${deleteTarget.email} fue eliminado`);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setDeleting(false);
    }
  }

  async function handleNotify() {
    if (!msgTitle.trim() || !msgBody.trim()) {
      toast.error('Completá el título y el mensaje');
      return;
    }
    setSending(true);
    try {
      const sent = await adminNotify(msgTitle.trim(), msgBody.trim());
      toast.success(`Mensaje enviado a ${sent} usuario${sent === 1 ? '' : 's'}`);
      setMsgTitle('');
      setMsgBody('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#080808] p-4 md:p-6 max-w-2xl mx-auto text-center py-20">
        <ShieldCheck size={40} className="mx-auto text-[#DC2626] mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Sin acceso</h1>
        <p className="text-sm text-[#9CA3AF]">
          Esta sección es solo para el administrador de la plataforma.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <ShieldCheck size={26} className="text-[#DC2626]" />
            Panel de administración
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            {rows.length} usuario{rows.length === 1 ? '' : 's'} registrado
            {rows.length === 1 ? '' : 's'}
            {newUsers.length > 0 && (
              <span className="text-emerald-400"> · {newUsers.length} nuevo(s) esta semana</span>
            )}
          </p>
        </div>
        <Button variant="secondary" onClick={() => load()} loading={loading} icon={<RefreshCw size={16} />}>
          Actualizar
        </Button>
      </div>

      {/* ---------- Mandar mensaje a todos ---------- */}
      <Card className="mb-6 border-[#DC2626]/30">
        <div className="flex items-center gap-2 mb-4">
          <Send size={18} className="text-[#DC2626]" />
          <h2 className="text-lg font-semibold text-white">Enviar mensaje a todos</h2>
        </div>
        <p className="text-xs text-[#9CA3AF] mb-4">
          El mensaje aparece en la campanita de notificaciones (arriba a la derecha) de cada usuario.
        </p>

        <div className="space-y-3">
          <Input
            placeholder="Título (ej: Novedades de ReTurnos)"
            value={msgTitle}
            onChange={(e) => setMsgTitle(e.target.value)}
            maxLength={80}
          />
          <textarea
            placeholder="Escribí el mensaje…"
            value={msgBody}
            onChange={(e) => setMsgBody(e.target.value)}
            rows={4}
            maxLength={600}
            className="w-full rounded-lg border border-[#333] bg-[#1A1A1A] text-white placeholder:text-[#9CA3AF] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#9CA3AF]">{msgBody.length}/600</span>
            <Button
              onClick={handleNotify}
              loading={sending}
              icon={<Send size={16} />}
              disabled={!msgTitle.trim() || !msgBody.trim()}
            >
              Enviar notificación
            </Button>
          </div>
        </div>
      </Card>

      {/* ---------- Lista de usuarios ---------- */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#9CA3AF]" />
            <h2 className="text-lg font-semibold text-white">Usuarios</h2>
          </div>
          <div className="relative w-full sm:w-64">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
            />
            <input
              type="text"
              placeholder="Buscar por email, nombre o negocio…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#333] bg-[#1A1A1A] text-white placeholder:text-[#9CA3AF] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
            />
          </div>
        </div>

        {loading && rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#9CA3AF]">Cargando usuarios…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Inbox size={32} className="mx-auto text-[#333] mb-3" />
            <p className="text-sm text-[#9CA3AF]">No hay usuarios para mostrar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left px-4 py-3 font-medium text-[#9CA3AF]">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium text-[#9CA3AF]">Negocio</th>
                  <th className="text-left px-4 py-3 font-medium text-[#9CA3AF]">Alta</th>
                  <th className="text-left px-4 py-3 font-medium text-[#9CA3AF]">Suscripción</th>
                  <th className="text-right px-4 py-3 font-medium text-[#9CA3AF]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const permanent =
                    row.subscription_status === 'active' && !row.subscription_ends_at;
                  return (
                    <tr key={row.id} className="border-b border-[#333]/50 last:border-0">
                      <td className="px-4 py-3">
                        <p className="text-white truncate max-w-[220px]">{row.email}</p>
                        {row.name && (
                          <p className="text-xs text-[#9CA3AF] truncate max-w-[220px]">{row.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#9CA3AF]">
                        {row.business_name ?? <span className="text-[#555]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#9CA3AF] whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(row.subscription_status)} dot>
                          {permanent ? 'Gratis para siempre' : statusLabel(row.subscription_status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant={permanent ? 'secondary' : 'primary'}
                            loading={grantingId === row.id}
                            disabled={permanent || !row.business_id}
                            onClick={() => handleGrant(row)}
                            icon={<Gift size={14} />}
                          >
                            {permanent ? 'Ya es gratis' : 'Gratis para siempre'}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteTarget(row)}
                            icon={<Trash2 size={14} />}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ---------- Confirmar eliminación ---------- */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar usuario"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
              <Trash2 size={18} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm text-white">
                Vas a eliminar a <span className="font-semibold">{deleteTarget?.email}</span>
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Se borra la cuenta, su negocio, reservas, productos y ventas. Esta acción no se
                puede deshacer.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete} icon={<Trash2 size={16} />}>
              Sí, eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
