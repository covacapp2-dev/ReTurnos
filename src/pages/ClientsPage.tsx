import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Users, Plus, Pencil, Trash2, Eye, ArrowLeft, Mail, Phone as PhoneIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, searchCustomers } from '../services/customers';
import type { Customer } from '../types';
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
  notes: string;
}

const defaultForm: FormData = {
  full_name: '',
  email: '',
  phone: '',
  notes: '',
};

export default function ClientsPage() {
  const { business } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', business?.id],
    queryFn: () => getCustomers(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const searchResults = useQuery({
    queryKey: ['customers-search', business?.id, search],
    queryFn: () => searchCustomers(business!.id, search),
    enabled: !!business?.id && search.length >= 2,
    select: (res) => res.data ?? [],
  });

  const displayList = search.length >= 2 ? searchResults.data ?? [] : customers;

  const createMut = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await createCustomer({
        business_id: business!.id,
        full_name: data.full_name,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', business?.id] });
      toast.success('Cliente creado');
      closeModal();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al crear cliente'),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const res = await updateCustomer(id, {
        full_name: data.full_name,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', business?.id] });
      toast.success('Cliente actualizado');
      closeModal();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al actualizar cliente'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteCustomer(id);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', business?.id] });
      toast.success('Cliente eliminado');
      setDeleteModal(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al eliminar cliente'),
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

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      full_name: c.full_name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      notes: c.notes ?? '',
    });
    setModalOpen(true);
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

  if (detailCustomer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => setDetailCustomer(null)}>
            Volver
          </Button>
          <h1 className="text-2xl font-bold text-white">Detalle del cliente</h1>
        </div>
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <Avatar src={null} name={detailCustomer.full_name} size="lg" />
            <div>
              <h2 className="text-xl font-semibold text-white">{detailCustomer.full_name}</h2>
              {detailCustomer.email && (
                <div className="flex items-center gap-1.5 text-sm text-[#9CA3AF] mt-1">
                  <Mail size={14} /> {detailCustomer.email}
                </div>
              )}
              {detailCustomer.phone && (
                <div className="flex items-center gap-1.5 text-sm text-[#9CA3AF] mt-0.5">
                  <PhoneIcon size={14} /> {detailCustomer.phone}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg bg-[#080808] border border-[#333] p-4 text-center">
              <div className="text-2xl font-bold text-white">{detailCustomer.total_appointments}</div>
              <div className="text-xs text-[#9CA3AF] mt-1">Turnos totales</div>
            </div>
            <div className="rounded-lg bg-[#080808] border border-[#333] p-4 text-center">
              <div className="text-sm font-semibold text-white">
                {detailCustomer.last_appointment_at
                  ? new Date(detailCustomer.last_appointment_at).toLocaleDateString('es-AR')
                  : '—'}
              </div>
              <div className="text-xs text-[#9CA3AF] mt-1">Último turno</div>
            </div>
            <div className="rounded-lg bg-[#080808] border border-[#333] p-4 text-center">
              <div className="text-sm font-semibold text-white">
                {new Date(detailCustomer.created_at).toLocaleDateString('es-AR')}
              </div>
              <div className="text-xs text-[#9CA3AF] mt-1">Cliente desde</div>
            </div>
          </div>
          {detailCustomer.notes && (
            <div>
              <h3 className="text-sm font-medium text-white mb-2">Notas</h3>
              <p className="text-sm text-[#9CA3AF] whitespace-pre-wrap">{detailCustomer.notes}</p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <Button icon={<Plus size={18} />} onClick={openCreate}>
          Nuevo cliente
        </Button>
      </div>

      <SearchInput
        placeholder="Buscar por nombre, email o teléfono..."
        onChange={setSearch}
        className="max-w-sm"
      />

      {isLoading || searchResults.isLoading ? (
        <LoadingSpinner />
      ) : displayList.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin clientes"
          description="Los clientes aparecerán aquí cuando hagan una reserva."
          actionLabel="Nuevo cliente"
          onAction={openCreate}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF] hidden sm:table-cell">Contacto</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF] hidden md:table-cell">Turnos</th>
                  <th className="text-right px-5 py-3 font-medium text-[#9CA3AF]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((c) => (
                  <tr key={c.id} className="border-b border-[#333]/50 last:border-0 hover:bg-[#222] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar src={null} name={c.full_name} size="sm" />
                        <div className="text-white font-medium">{c.full_name}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <div className="text-[#9CA3AF] text-xs">
                        {c.email && <div>{c.email}</div>}
                        {c.phone && <div>{c.phone}</div>}
                        {!c.email && !c.phone && '—'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <Badge variant="info">{c.total_appointments}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Eye size={15} />} onClick={() => setDetailCustomer(c)} />
                        <Button variant="ghost" size="sm" icon={<Pencil size={15} />} onClick={() => openEdit(c)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => setDeleteModal(c.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? 'Editar cliente' : 'Nuevo cliente'} maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre completo"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Ej: María López"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="maria@email.com"
            />
            <Input
              label="Teléfono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+54 11 1234-5678"
            />
          </div>
          <Textarea
            label="Notas"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notas sobre el cliente..."
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Eliminar cliente" maxWidth="sm">
        <p className="text-[#9CA3AF] text-sm mb-5">
          ¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer.
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
