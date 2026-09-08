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
} from '../services/professionals';
import { getServices } from '../services/services';
import type { Professional, ProfessionalService } from '../types';
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

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string;
  bio: string;
  is_active: boolean;
  service_ids: string[];
}

const defaultForm: FormData = {
  full_name: '',
  email: '',
  phone: '',
  avatar_url: '',
  bio: '',
  is_active: true,
  service_ids: [],
};

export default function ProfessionalsPage() {
  const { business } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);

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
      const { data: pro } = await createProfessional({
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
      if (pro && data.service_ids.length > 0) {
        for (const sid of data.service_ids) {
          await assignServiceToProfessional({ professional_id: pro.id, service_id: sid, custom_price: null, custom_duration_minutes: null });
        }
      }
      return pro;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals', business?.id] });
      toast.success('Profesional creado');
      closeModal();
    },
    onError: () => toast.error('Error al crear profesional'),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      await updateProfessional(id, {
        full_name: data.full_name,
        email: data.email || null,
        phone: data.phone || null,
        avatar_url: data.avatar_url || null,
        bio: data.bio || null,
        is_active: data.is_active,
      });
      const existing = await getProfessionalServices(id);
      const existingIds = (existing.data ?? []).map((ps) => ps.service_id);
      for (const sid of existingIds) {
        if (!data.service_ids.includes(sid)) {
          await removeServiceFromProfessional(id, sid);
        }
      }
      for (const sid of data.service_ids) {
        if (!existingIds.includes(sid)) {
          await assignServiceToProfessional({ professional_id: id, service_id: sid, custom_price: null, custom_duration_minutes: null });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals', business?.id] });
      toast.success('Profesional actualizado');
      closeModal();
    },
    onError: () => toast.error('Error al actualizar profesional'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteProfessional(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals', business?.id] });
      toast.success('Profesional eliminado');
      setDeleteModal(null);
    },
    onError: () => toast.error('Error al eliminar profesional'),
  });

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
    setForm(defaultForm);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setModalOpen(true);
  };

  const openEdit = async (pro: Professional) => {
    setEditing(pro);
    const res = await getProfessionalServices(pro.id);
    const serviceIds = (res.data ?? []).map((ps: ProfessionalService) => ps.service_id);
    setForm({
      full_name: pro.full_name,
      email: pro.email ?? '',
      phone: pro.phone ?? '',
      avatar_url: pro.avatar_url ?? '',
      bio: pro.bio ?? '',
      is_active: pro.is_active,
      service_ids: serviceIds,
    });
    setModalOpen(true);
  };

  const toggleService = (sid: string) => {
    setForm((prev) => ({
      ...prev,
      service_ids: prev.service_ids.includes(sid)
        ? prev.service_ids.filter((id) => id !== sid)
        : [...prev.service_ids, sid],
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

      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? 'Editar profesional' : 'Nuevo profesional'} maxWidth="lg">
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
          <Input
            label="URL del avatar"
            value={form.avatar_url}
            onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
            placeholder="https://..."
          />
          <Textarea
            label="Bio"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Breve descripción..."
          />
          <div>
            <label className="block text-sm font-medium text-white mb-2">Servicios asignados</label>
            <div className="max-h-48 overflow-y-auto space-y-2 rounded-lg border border-[#333] p-3">
              {allServices.length === 0 ? (
                <p className="text-xs text-[#9CA3AF]">No hay servicios disponibles</p>
              ) : (
                allServices.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={form.service_ids.includes(s.id)}
                      onChange={() => toggleService(s.id)}
                      className="w-4 h-4 rounded border-[#333] bg-[#1A1A1A] text-[#DC2626] focus:ring-[#DC2626]/50"
                    />
                    <span className="text-sm text-white">{s.name}</span>
                    <span className="text-xs text-[#9CA3AF] ml-auto">{s.duration_minutes} min</span>
                  </label>
                ))
              )}
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
