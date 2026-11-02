import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Pencil, Trash2, CalendarPlus, MapPin } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getCourts, createCourt, updateCourt, deleteCourt } from '../services/courts';
import { SPORTS, sportEmoji } from '../constants/sports';
import type { Resource } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function CourtsPage() {
  const { sport: sportParam } = useParams<{ sport: string }>();
  const navigate = useNavigate();
  const { business } = useAuth();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [courtName, setCourtName] = useState('');
  const [sportForNew, setSportForNew] = useState('');
  const [deleteModal, setDeleteModal] = useState<Resource | null>(null);

  const { data: courts = [], isLoading } = useQuery({
    queryKey: ['courts', business?.id],
    queryFn: () => getCourts(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const bySport = useMemo(() => {
    const map = new Map<string, Resource[]>();
    for (const c of courts) {
      const key = c.sport ?? '';
      if (!key) continue;
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return map;
  }, [courts]);

  const sportsToShow = sportParam ? [sportParam] : SPORTS.map((s) => s.label);

  // --- Mutaciones ---
  const createMut = useMutation({
    mutationFn: async ({ sport, name }: { sport: string; name: string }) => {
      const res = await createCourt(business!.id, sport, name);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courts', business?.id] });
      toast.success('Cancha creada');
      closeModal();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al crear cancha'),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await updateCourt(id, { name });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courts', business?.id] });
      toast.success('Cancha actualizada');
      closeModal();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al actualizar cancha'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteCourt(id);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courts', business?.id] });
      toast.success('Cancha eliminada');
      setDeleteModal(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al eliminar cancha'),
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setCourtName('');
    setSportForNew('');
  };

  const openCreate = (sport: string) => {
    setEditing(null);
    setCourtName('');
    setSportForNew(sport);
    setModalOpen(true);
  };

  const openEdit = (c: Resource) => {
    setEditing(c);
    setCourtName(c.name);
    setSportForNew(c.sport ?? '');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courtName.trim()) {
      toast.error('El nombre de la cancha es requerido');
      return;
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, name: courtName.trim() });
    } else {
      createMut.mutate({ sport: sportForNew, name: courtName.trim() });
    }
  };

  const goToAppointment = (court: Resource) => {
    navigate('/appointments/new', {
      state: { resourceId: court.id, resourceName: court.name, sport: court.sport },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/dashboard')}
          >
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {sportParam ? `${sportEmoji(sportParam)} ${sportParam}` : 'Canchas'}
            </h1>
            <p className="text-sm text-[#9CA3AF]">
              {sportParam
                ? `Canchas de ${sportParam.toLowerCase()}`
                : 'Canchas del complejo por deporte'}
            </p>
          </div>
        </div>
        {!sportParam && (
          <Button icon={<Plus size={18} />} onClick={() => openCreate(SPORTS[0].label)}>
            Nueva cancha
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : sportParam && courts.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={`Sin canchas de ${sportParam.toLowerCase()}`}
          description="Creá la primera cancha para empezar a reservar."
          actionLabel="Nueva cancha"
          onAction={() => openCreate(sportParam)}
        />
      ) : (
        <div className="space-y-6">
          {sportsToShow.map((sport) => {
            const list = bySport.get(sport) ?? [];
            if (sportParam) return null; // en vista de un solo deporte se renderiza abajo
            return (
              <Card key={sport}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-white font-semibold">
                    {sportEmoji(sport)} {sport}{' '}
                    <span className="text-[#9CA3AF] font-normal text-sm">
                      · {list.length} cancha{list.length === 1 ? '' : 's'}
                    </span>
                  </h2>
                  <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => openCreate(sport)}>
                    Agregar
                  </Button>
                </div>
                {list.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF]">Todavía no hay canchas de este deporte.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {list.map((court) => (
                      <div
                        key={court.id}
                        className="border border-[#333] bg-[#111] rounded-lg p-3 flex items-center justify-between gap-2"
                      >
                        <button
                          className="flex-1 min-w-0 text-left"
                          onClick={() => goToAppointment(court)}
                        >
                          <div className="text-white text-sm font-medium truncate">{court.name}</div>
                          <div className="text-xs text-[#DC2626]">Cargar turno →</div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(court)}
                            className="p-1.5 text-[#9CA3AF] hover:text-white"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteModal(court)}
                            className="p-1.5 text-[#9CA3AF] hover:text-red-400"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Vista de un solo deporte (lobby) */}
          {sportParam && (
            <>
              <div className="flex justify-end">
                <Button icon={<Plus size={18} />} onClick={() => openCreate(sportParam)}>
                  Nueva cancha
                </Button>
              </div>
              {(bySport.get(sportParam) ?? []).length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title={`Sin canchas de ${sportParam.toLowerCase()}`}
                  description="Creá la primera cancha para empezar a reservar."
                  actionLabel="Nueva cancha"
                  onAction={() => openCreate(sportParam)}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(bySport.get(sportParam) ?? []).map((court) => (
                    <div
                      key={court.id}
                      className="border border-[#333] bg-[#1A1A1A] rounded-xl p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-white font-semibold">{court.name}</div>
                          <div className="text-xs text-[#9CA3AF] mt-0.5">
                            {sportEmoji(sportParam)} {sportParam}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(court)}
                            className="p-1.5 text-[#9CA3AF] hover:text-white"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteModal(court)}
                            className="p-1.5 text-[#9CA3AF] hover:text-red-400"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        icon={<CalendarPlus size={15} />}
                        onClick={() => goToAppointment(court)}
                        className="w-full"
                      >
                        Cargar turno
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? 'Editar cancha' : `Nueva cancha${sportForNew ? ` · ${sportForNew}` : ''}`}
        maxWidth="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre de la cancha"
            value={courtName}
            onChange={(e) => setCourtName(e.target.value)}
            placeholder="Ej: Cancha 1"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal eliminar */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Eliminar cancha"
        maxWidth="sm"
      >
        <p className="text-[#9CA3AF] text-sm mb-5">
          ¿Estás seguro de que querés eliminar <span className="text-white">{deleteModal?.name}</span>?
          Los turnos ya creados no se borran.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteModal(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleteMut.isPending}
            onClick={() => deleteModal && deleteMut.mutate(deleteModal.id)}
          >
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
