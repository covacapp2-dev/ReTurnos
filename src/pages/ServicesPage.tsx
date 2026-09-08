import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Scissors, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getServices, createService, updateService, deleteService } from '../services/services';
import type { Service } from '../types';
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

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 90, label: '90 min' },
  { value: 120, label: '120 min' },
];

interface FormData {
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
}

const defaultForm: FormData = {
  name: '',
  description: '',
  duration_minutes: 30,
  price: 0,
  is_active: true,
};

export default function ServicesPage() {
  const { business } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => getServices(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const createMut = useMutation({
    mutationFn: (data: FormData) =>
      createService({
        business_id: business!.id,
        branch_id: null,
        name: data.name,
        description: data.description || null,
        duration_minutes: data.duration_minutes,
        price: data.price,
        currency: business?.currency ?? 'ARS',
        color: null,
        is_active: data.is_active,
        allows_online_booking: true,
        max_advance_days: null,
        min_advance_minutes: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', business?.id] });
      toast.success('Servicio creado');
      closeModal();
    },
    onError: () => toast.error('Error al crear servicio'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      updateService(id, {
        name: data.name,
        description: data.description || null,
        duration_minutes: data.duration_minutes,
        price: data.price,
        is_active: data.is_active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', business?.id] });
      toast.success('Servicio actualizado');
      closeModal();
    },
    onError: () => toast.error('Error al actualizar servicio'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', business?.id] });
      toast.success('Servicio eliminado');
      setDeleteModal(null);
    },
    onError: () => toast.error('Error al eliminar servicio'),
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

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description ?? '',
      duration_minutes: s.duration_minutes,
      price: s.price,
      is_active: s.is_active,
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

  const filtered = services.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Servicios</h1>
        <Button icon={<Plus size={18} />} onClick={openCreate}>
          Nuevo servicio
        </Button>
      </div>

      <SearchInput
        placeholder="Buscar servicios..."
        onChange={setSearch}
        className="max-w-sm"
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="Sin servicios"
          description="Crea tu primer servicio para comenzar a recibir turnos."
          actionLabel="Nuevo servicio"
          onAction={openCreate}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF] hidden sm:table-cell">Duración</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF] hidden sm:table-cell">Precio</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Estado</th>
                  <th className="text-right px-5 py-3 font-medium text-[#9CA3AF]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-[#333]/50 last:border-0 hover:bg-[#222] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="text-white font-medium">{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-[#9CA3AF] mt-0.5 truncate max-w-[200px]">{s.description}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[#9CA3AF] hidden sm:table-cell">{s.duration_minutes} min</td>
                    <td className="px-5 py-3.5 text-[#9CA3AF] hidden sm:table-cell">${s.price.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={s.is_active ? 'success' : 'default'} dot>
                        {s.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Pencil size={15} />} onClick={() => openEdit(s)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => setDeleteModal(s.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? 'Editar servicio' : 'Nuevo servicio'} maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Corte de cabello"
          />
          <Textarea
            label="Descripción"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descripción del servicio..."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Duración"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              options={DURATION_OPTIONS}
            />
            <Input
              label="Precio"
              type="number"
              min={0}
              step={0.01}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
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

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Eliminar servicio" maxWidth="sm">
        <p className="text-[#9CA3AF] text-sm mb-5">
          ¿Estás seguro de que deseas eliminar este servicio? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteModal(null)}>Cancelar</Button>
          <Button
            variant="danger"
            loading={deleteMut.isPending}
            onClick={() => deleteModal && deleteMut.mutate(deleteModal)}
          >
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
