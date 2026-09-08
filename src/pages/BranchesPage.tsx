import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getBranches, createBranch, updateBranch, deleteBranch } from '../services/branches';
import type { Branch } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SearchInput from '../components/ui/SearchInput';
import Textarea from '../components/ui/Textarea';

interface FormData {
  name: string;
  address: string;
  phone: string;
  is_active: boolean;
}

const defaultForm: FormData = {
  name: '',
  address: '',
  phone: '',
  is_active: true,
};

export default function BranchesPage() {
  const { business } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches', business?.id],
    queryFn: () => getBranches(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const createMut = useMutation({
    mutationFn: (data: FormData) =>
      createBranch({
        business_id: business!.id,
        name: data.name,
        address: data.address || null,
        phone: data.phone || null,
        email: null,
        is_active: data.is_active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', business?.id] });
      toast.success('Sucursal creada');
      closeModal();
    },
    onError: () => toast.error('Error al crear sucursal'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      updateBranch(id, {
        name: data.name,
        address: data.address || null,
        phone: data.phone || null,
        is_active: data.is_active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', business?.id] });
      toast.success('Sucursal actualizada');
      closeModal();
    },
    onError: () => toast.error('Error al actualizar sucursal'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', business?.id] });
      toast.success('Sucursal eliminada');
      setDeleteModal(null);
    },
    onError: () => toast.error('Error al eliminar sucursal'),
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

  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({
      name: b.name,
      address: b.address ?? '',
      phone: b.phone ?? '',
      is_active: b.is_active,
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

  const filtered = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.address?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Sucursales</h1>
        <Button icon={<Plus size={18} />} onClick={openCreate}>
          Nueva sucursal
        </Button>
      </div>

      <SearchInput placeholder="Buscar sucursales..." onChange={setSearch} className="max-w-sm" />

      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin sucursales"
          description="Agrega sucursales para organizar tus turnos por ubicación."
          actionLabel="Nueva sucursal"
          onAction={openCreate}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF] hidden sm:table-cell">Dirección</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF] hidden md:table-cell">Teléfono</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Estado</th>
                  <th className="text-right px-5 py-3 font-medium text-[#9CA3AF]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-b border-[#333]/50 last:border-0 hover:bg-[#222] transition-colors">
                    <td className="px-5 py-3.5 text-white font-medium">{b.name}</td>
                    <td className="px-5 py-3.5 text-[#9CA3AF] hidden sm:table-cell">{b.address ?? '—'}</td>
                    <td className="px-5 py-3.5 text-[#9CA3AF] hidden md:table-cell">{b.phone ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={b.is_active ? 'success' : 'default'} dot>
                        {b.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Pencil size={15} />} onClick={() => openEdit(b)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => setDeleteModal(b.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? 'Editar sucursal' : 'Nueva sucursal'} maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Sucursal Centro"
          />
          <Textarea
            label="Dirección"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Av. Principal 1234"
          />
          <Input
            label="Teléfono"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+54 11 1234-5678"
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
            <span className="text-sm text-white">Activa</span>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Eliminar sucursal" maxWidth="sm">
        <p className="text-[#9CA3AF] text-sm mb-5">
          ¿Estás seguro de que deseas eliminar esta sucursal? Esta acción no se puede deshacer.
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
