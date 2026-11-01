import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Box, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getResources, createResource, updateResource, deleteResource } from '../services/resources';
import type { Resource } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';

const RESOURCE_TYPES = [
  { value: 'room', label: 'Cancha' },
  { value: 'equipment', label: 'Consultorio' },
  { value: 'table', label: 'Sala' },
  { value: 'vehicle', label: 'Sillón' },
  { value: 'other', label: 'Otro' },
];

interface FormData {
  name: string;
  description: string;
  resource_type: string;
  is_active: boolean;
}

const defaultForm: FormData = {
  name: '',
  description: '',
  resource_type: 'room',
  is_active: true,
};

export default function ResourcesPage() {
  const { business } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['resources', business?.id],
    queryFn: () => getResources(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const createMut = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await createResource({
        business_id: business!.id,
        branch_id: null,
        name: data.name,
        description: data.description || null,
        type: data.resource_type as Resource['type'],
        is_active: data.is_active,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', business?.id] });
      toast.success('Recurso creado');
      closeModal();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al crear recurso'),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const res = await updateResource(id, {
        name: data.name,
        description: data.description || null,
        type: data.resource_type as Resource['type'],
        is_active: data.is_active,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', business?.id] });
      toast.success('Recurso actualizado');
      closeModal();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al actualizar recurso'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteResource(id);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', business?.id] });
      toast.success('Recurso eliminado');
      setDeleteModal(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al eliminar recurso'),
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

  const openEdit = (r: Resource) => {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description ?? '',
      resource_type: r.type,
      is_active: r.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: form });
    } else {
      createMut.mutate(form);
    }
  };

  const filtered = resources.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Recursos</h1>
        <Button icon={<Plus size={18} />} onClick={openCreate}>
          Nuevo recurso
        </Button>
      </div>

      <SearchInput placeholder="Buscar recursos..." onChange={setSearch} className="max-w-sm" />

      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Box}
          title="Sin recursos"
          description="Agrega recursos como canchas, consultorios o salas."
          actionLabel="Nuevo recurso"
          onAction={openCreate}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF] hidden sm:table-cell">Tipo</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Estado</th>
                  <th className="text-right px-5 py-3 font-medium text-[#9CA3AF]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-[#333]/50 last:border-0 hover:bg-[#222] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="text-white font-medium">{r.name}</div>
                      {r.description && (
                        <div className="text-xs text-[#9CA3AF] mt-0.5 truncate max-w-[200px]">{r.description}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <Badge variant="info">{RESOURCE_TYPES.find((t) => t.value === r.type)?.label ?? r.type}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={r.is_active ? 'success' : 'default'} dot>
                        {r.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Pencil size={15} />} onClick={() => openEdit(r)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => setDeleteModal(r.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? 'Editar recurso' : 'Nuevo recurso'} maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Cancha 1"
          />
          <Textarea
            label="Descripción"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descripción del recurso..."
          />
          <Select
            label="Tipo de recurso"
            value={form.resource_type}
            onChange={(e) => setForm({ ...form, resource_type: e.target.value })}
            options={RESOURCE_TYPES}
          />
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

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Eliminar recurso" maxWidth="sm">
        <p className="text-[#9CA3AF] text-sm mb-5">
          ¿Estás seguro de que deseas eliminar este recurso? Esta acción no se puede deshacer.
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
