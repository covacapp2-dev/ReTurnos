import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Users, Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  getProfessionals,
  createProfessional,
  updateProfessional,
  deleteProfessional,
  getProfessionalServices,
  assignServiceToProfessional,
  removeServiceFromProfessional,
  updateServiceDuration,
} from '../services/professionals';
import { getServices } from '../services/services';
import { getAvailability, upsertAvailability } from '../services/availability';
import type { Professional, ProfessionalService, Availability } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SearchInput from '../components/ui/SearchInput';
import Textarea from '../components/ui/Textarea';
import Avatar from '../components/ui/Avatar';

const DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

interface DaySchedule {
  day_of_week: number;
  is_active: boolean;
  blocks: { start_time: string; end_time: string }[];
}

function emptySchedule(): DaySchedule[] {
  return DAYS.map((d) => ({
    day_of_week: d.value,
    is_active: false,
    blocks: [{ start_time: '09:00', end_time: '18:00' }],
  }));
}

function scheduleFromAvailability(avail: Availability[]): DaySchedule[] {
  const grouped: Record<number, { start_time: string; end_time: string }[]> = {};
  avail.forEach((a) => {
    if (!DAYS.some((d) => d.value === a.day_of_week)) return;
    if (!grouped[a.day_of_week]) grouped[a.day_of_week] = [];
    grouped[a.day_of_week].push({
      start_time: a.start_time.slice(0, 5),
      end_time: a.end_time.slice(0, 5),
    });
  });

  return DAYS.map((d) => ({
    day_of_week: d.value,
    is_active: !!grouped[d.value]?.length,
    blocks: grouped[d.value]?.length
      ? grouped[d.value]
      : [{ start_time: '09:00', end_time: '18:00' }],
  }));
}

function scheduleToSlots(schedule: DaySchedule[]) {
  return schedule
    .filter((d) => d.is_active)
    .flatMap((d) =>
      d.blocks
        .filter((b) => b.start_time && b.end_time && b.start_time < b.end_time)
        .map((b) => ({
          day_of_week: d.day_of_week,
          start_time: b.start_time,
          end_time: b.end_time,
          is_active: true,
        }))
    );
}

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string;
  bio: string;
  is_active: boolean;
  service_ids: string[];
  durations: Record<string, string>;
  schedule: DaySchedule[];
}

const defaultForm: FormData = {
  full_name: '',
  email: '',
  phone: '',
  avatar_url: '',
  bio: '',
  is_active: true,
  service_ids: [],
  durations: {},
  schedule: emptySchedule(),
};

export default function ProfessionalsPage() {
  const { business } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [availLoaded, setAvailLoaded] = useState(false);

  const { data: professionals = [], isLoading } = useQuery({
    queryKey: ['professionals', business?.id],
    queryFn: () => getProfessionals(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const { data: allServices = [] } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => getServices(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const proServiceCounts = useQuery({
    queryKey: ['professional-service-counts', professionals.map((p) => p.id)],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const pro of professionals) {
        const res = await getProfessionalServices(pro.id);
        counts[pro.id] = res.data?.length ?? 0;
      }
      return counts;
    },
    enabled: professionals.length > 0,
  });

  const createMut = useMutation({
    mutationFn: async (data: FormData) => {
      const profRes = await createProfessional({
        business_id: business!.id,
        branch_id: null,
        user_id: null,
        full_name: data.full_name,
        email: data.email || null,
        phone: data.phone || null,
        avatar_url: data.avatar_url || null,
        bio: data.bio || null,
        is_active: data.is_active,
      });
      if (profRes.error) throw new Error(profRes.error.message);
      const pro = profRes.data!;
      for (const sid of data.service_ids) {
        const mins = parseInt(data.durations[sid] ?? '', 10);
        const as = await assignServiceToProfessional({
          professional_id: pro.id,
          service_id: sid,
          custom_price: null,
          custom_duration_minutes: Number.isFinite(mins) && mins > 0 ? mins : null,
        });
        if (as.error) throw new Error(as.error.message);
      }
      const slots = scheduleToSlots(data.schedule);
      if (slots.length > 0) {
        const av = await upsertAvailability(pro.id, slots);
        if (av.error) throw new Error(av.error.message);
      }
      return pro;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals', business?.id] });
      queryClient.invalidateQueries({ queryKey: ['professional-service-counts'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      toast.success('Profesional creado');
      closeModal();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al crear profesional'),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const res = await updateProfessional(id, {
        full_name: data.full_name,
        email: data.email || null,
        phone: data.phone || null,
        avatar_url: data.avatar_url || null,
        bio: data.bio || null,
        is_active: data.is_active,
      });
      if (res.error) throw new Error(res.error.message);

      // Servicios asignados + duración personalizada
      const existing = await getProfessionalServices(id);
      if (existing.error) throw new Error(existing.error.message);
      const existingRows = existing.data ?? [];
      for (const row of existingRows) {
        if (!data.service_ids.includes(row.service_id)) {
          const rm = await removeServiceFromProfessional(id, row.service_id);
          if (rm.error) throw new Error(rm.error.message);
        }
      }
      const existingIds = existingRows.map((r) => r.service_id);
      for (const sid of data.service_ids) {
        const mins = parseInt(data.durations[sid] ?? '', 10);
        const duration = Number.isFinite(mins) && mins > 0 ? mins : null;
        if (existingIds.includes(sid)) {
          const current = existingRows.find((r) => r.service_id === sid)?.custom_duration_minutes ?? null;
          if (current !== duration) {
            const upd = await updateServiceDuration(id, sid, duration);
            if (upd.error) throw new Error(upd.error.message);
          }
        } else {
          const as = await assignServiceToProfessional({
            professional_id: id,
            service_id: sid,
            custom_price: null,
            custom_duration_minutes: duration,
          });
          if (as.error) throw new Error(as.error.message);
        }
      }

      // Disponibilidad horaria
      if (availLoaded) {
        const av = await upsertAvailability(id, scheduleToSlots(data.schedule));
        if (av.error) throw new Error(av.error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals', business?.id] });
      queryClient.invalidateQueries({ queryKey: ['professional-service-counts'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      toast.success('Profesional actualizado');
      closeModal();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al actualizar profesional'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteProfessional(id);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals', business?.id] });
      toast.success('Profesional eliminado');
      setDeleteModal(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al eliminar profesional'),
  });

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
    setForm(defaultForm);
    setAvailLoaded(false);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setAvailLoaded(true);
    setModalOpen(true);
  };

  const openEdit = async (pro: Professional) => {
    setEditing(pro);
    setAvailLoaded(false);
    setForm({ ...defaultForm, full_name: pro.full_name });
    setModalOpen(true);

    const svcRes = await getProfessionalServices(pro.id);
    if (!svcRes.error) {
      const rows = svcRes.data ?? [];
      const durations: Record<string, string> = {};
      rows.forEach((ps) => {
        if (ps.custom_duration_minutes != null) {
          durations[ps.service_id] = String(ps.custom_duration_minutes);
        }
      });
      setForm((prev) => ({
        ...prev,
        full_name: pro.full_name,
        email: pro.email ?? '',
        phone: pro.phone ?? '',
        avatar_url: pro.avatar_url ?? '',
        bio: pro.bio ?? '',
        is_active: pro.is_active,
        service_ids: rows.map((ps: ProfessionalService) => ps.service_id),
        durations,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        full_name: pro.full_name,
        email: pro.email ?? '',
        phone: pro.phone ?? '',
        avatar_url: pro.avatar_url ?? '',
        bio: pro.bio ?? '',
        is_active: pro.is_active,
      }));
    }

    const availRes = await getAvailability(pro.id);
    if (availRes.error) {
      toast.error('No se pudieron cargar los horarios');
      return;
    }
    setForm((prev) => ({ ...prev, schedule: scheduleFromAvailability(availRes.data ?? []) }));
    setAvailLoaded(true);
  };

  const toggleService = (sid: string) => {
    setForm((prev) => ({
      ...prev,
      service_ids: prev.service_ids.includes(sid)
        ? prev.service_ids.filter((id) => id !== sid)
        : [...prev.service_ids, sid],
    }));
  };

  const setDuration = (sid: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      durations: { ...prev.durations, [sid]: value.replace(/[^0-9]/g, '').slice(0, 4) },
    }));
  };

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((d) =>
        d.day_of_week === day ? { ...d, is_active: !d.is_active } : d
      ),
    }));
  };

  const updateBlock = (day: number, index: number, field: 'start_time' | 'end_time', value: string) => {
    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((d) =>
        d.day_of_week === day
          ? {
              ...d,
              blocks: d.blocks.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
            }
          : d
      ),
    }));
  };

  const addBlock = (day: number) => {
    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((d) =>
        d.day_of_week === day
          ? { ...d, blocks: [...d.blocks, { start_time: '09:00', end_time: '18:00' }] }
          : d
      ),
    }));
  };

  const removeBlock = (day: number, index: number) => {
    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((d) =>
        d.day_of_week === day
          ? { ...d, blocks: d.blocks.filter((_, i) => i !== index) }
          : d
      ),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: form });
    } else {
      createMut.mutate(form);
    }
  };

  const filtered = professionals.filter(
    (p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      p.bio?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Profesionales</h1>
        <Button icon={<Plus size={18} />} onClick={openCreate}>
          Nuevo profesional
        </Button>
      </div>

      <SearchInput placeholder="Buscar profesionales..." onChange={setSearch} className="max-w-sm" />

      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin profesionales"
          description="Agrega profesionales para asignar turnos."
          actionLabel="Nuevo profesional"
          onAction={openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((pro) => (
            <Card key={pro.id} className="flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <Avatar src={pro.avatar_url} name={pro.full_name} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold truncate">{pro.full_name}</div>
                  {pro.bio && <div className="text-xs text-[#9CA3AF] mt-0.5 line-clamp-2">{pro.bio}</div>}
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant={pro.is_active ? 'success' : 'default'} dot>
                      {pro.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Badge variant="info">{proServiceCounts.data?.[pro.id] ?? 0} servicios</Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-auto pt-3 border-t border-[#333]/50">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Calendar size={15} />}
                  onClick={() => openEdit(pro)}
                >
                  Horarios
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" icon={<Pencil size={15} />} onClick={() => openEdit(pro)} />
                <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => setDeleteModal(pro.id)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? 'Editar profesional' : 'Nuevo profesional'} maxWidth="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre completo"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Ej: Juan Pérez"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="juan@email.com"
            />
            <Input
              label="Teléfono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+54 11 1234-5678"
            />
          </div>
          <Textarea
            label="Bio"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Breve descripción..."
          />
          <div>
            <label className="block text-sm font-medium text-white mb-2">Servicios asignados</label>
            <div className="max-h-56 overflow-y-auto space-y-2 rounded-lg border border-[#333] p-3">
              {allServices.length === 0 ? (
                <p className="text-xs text-[#9CA3AF]">No hay servicios disponibles</p>
              ) : (
                allServices.map((s) => {
                  const checked = form.service_ids.includes(s.id);
                  return (
                    <div key={s.id} className="flex items-center gap-3 py-1">
                      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleService(s.id)}
                          className="w-4 h-4 rounded border-[#333] bg-[#1A1A1A] text-[#DC2626] focus:ring-[#DC2626]/50"
                        />
                        <span className="text-sm text-white truncate">{s.name}</span>
                      </label>
                      {checked && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={form.durations[s.id] ?? ''}
                            onChange={(e) => setDuration(s.id, e.target.value)}
                            placeholder={String(s.duration_minutes)}
                            title="Minutos que tarda este profesional en este servicio"
                            className="w-20 rounded-lg border border-[#333] bg-[#080808] text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 placeholder:text-[#9CA3AF]"
                          />
                          <span className="text-xs text-[#9CA3AF]">min</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <p className="mt-1.5 text-xs text-[#9CA3AF]">
              Los minutos son opcionales: si los dejás vacíos se usa el tiempo del servicio.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-white">Horario disponible</label>
              <span className="text-xs text-[#9CA3AF]">Días y horarios de atención</span>
            </div>
            <div className="space-y-2">
              {form.schedule.map((d) => {
                const dayLabel = DAYS.find((x) => x.value === d.day_of_week)?.label ?? '';
                return (
                  <div key={d.day_of_week} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleDay(d.day_of_week)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        d.is_active ? 'bg-[#DC2626]' : 'bg-[#333]'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          d.is_active ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-xs w-20 ${d.is_active ? 'text-white' : 'text-[#9CA3AF]'}`}>
                      {dayLabel}
                    </span>
                    {d.is_active && (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="time"
                          value={d.blocks[0]?.start_time ?? '09:00'}
                          onChange={(e) => updateBlock(d.day_of_week, 0, 'start_time', e.target.value)}
                          className="rounded-lg border border-[#333] bg-[#080808] text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50"
                        />
                        <span className="text-[#9CA3AF]">—</span>
                        <input
                          type="time"
                          value={d.blocks[0]?.end_time ?? '18:00'}
                          onChange={(e) => updateBlock(d.day_of_week, 0, 'end_time', e.target.value)}
                          className="rounded-lg border border-[#333] bg-[#080808] text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50"
                        />
                        <button
                          type="button"
                          onClick={() => addBlock(d.day_of_week)}
                          title="Agregar otro bloque horario"
                          className="p-1 text-[#9CA3AF] hover:text-white transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                        {d.blocks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBlock(d.day_of_week, d.blocks.length - 1)}
                            title="Quitar último bloque"
                            className="p-1 text-[#9CA3AF] hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {form.schedule.some((d) => d.is_active && d.blocks.length > 1) && (
                <div className="pl-11 space-y-1.5">
                  {form.schedule
                    .filter((d) => d.is_active)
                    .flatMap((d) =>
                      d.blocks.slice(1).map((b, i) => (
                        <div key={`${d.day_of_week}-${i + 1}`} className="flex items-center gap-1.5">
                          <span className="text-xs text-[#9CA3AF] w-20">
                            {DAYS.find((x) => x.value === d.day_of_week)?.label}
                          </span>
                          <input
                            type="time"
                            value={b.start_time}
                            onChange={(e) => updateBlock(d.day_of_week, i + 1, 'start_time', e.target.value)}
                            className="rounded-lg border border-[#333] bg-[#080808] text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50"
                          />
                          <span className="text-[#9CA3AF]">—</span>
                          <input
                            type="time"
                            value={b.end_time}
                            onChange={(e) => updateBlock(d.day_of_week, i + 1, 'end_time', e.target.value)}
                            className="rounded-lg border border-[#333] bg-[#080808] text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50"
                          />
                          <button
                            type="button"
                            onClick={() => removeBlock(d.day_of_week, i + 1)}
                            className="p-1 text-[#9CA3AF] hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                </div>
              )}
              <p className="text-xs text-[#9CA3AF]">
                Los días apagados no reciben turnos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.is_active ? 'bg-[#DC2626]' : 'bg-[#333]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-white">Activo</span>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Eliminar profesional" maxWidth="sm">
        <p className="text-[#9CA3AF] text-sm mb-5">
          ¿Estás seguro de que deseas eliminar este profesional? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteModal(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleteMut.isPending} onClick={() => deleteModal && deleteMut.mutate(deleteModal)}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
