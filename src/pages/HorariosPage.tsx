import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, CalendarOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getProfessionals } from '../services/professionals';
import { getAvailability, upsertAvailability, getBlockedDates, createBlockedDate, deleteBlockedDate } from '../services/availability';
import type { Availability, BlockedDate } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import LoadingSpinner from '../components/ui/LoadingSpinner';

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

interface BlockedForm {
  start_time: string;
  end_time: string;
  reason: string;
  is_all_day: boolean;
}

function buildEmptySchedule(): DaySchedule[] {
  return DAYS.map((d) => ({
    day_of_week: d.value,
    is_active: false,
    blocks: [{ start_time: '09:00', end_time: '18:00' }],
  }));
}

export default function HorariosPage() {
  const { business } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPro, setSelectedPro] = useState('');
  const [schedule, setSchedule] = useState<DaySchedule[]>(buildEmptySchedule());
  const [blockedModal, setBlockedModal] = useState(false);
  const [blockedForm, setBlockedForm] = useState<BlockedForm>({
    start_time: '',
    end_time: '',
    reason: '',
    is_all_day: true,
  });

  const { data: professionals = [], isLoading: loadingPros } = useQuery({
    queryKey: ['professionals', business?.id],
    queryFn: () => getProfessionals(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  const { data: availabilityData = [], isLoading: loadingAvail } = useQuery({
    queryKey: ['availability', selectedPro],
    queryFn: () => getAvailability(selectedPro),
    enabled: !!selectedPro,
    select: (res) => res.data ?? [],
  });

  const { data: blockedDates = [], isLoading: loadingBlocked } = useQuery({
    queryKey: ['blocked-dates', selectedPro],
    queryFn: () => getBlockedDates(selectedPro),
    enabled: !!selectedPro,
    select: (res) => res.data ?? [],
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const slots = schedule
        .filter((d) => d.is_active)
        .flatMap((d) =>
          d.blocks.map((b) => ({
            day_of_week: d.day_of_week,
            start_time: b.start_time,
            end_time: b.end_time,
            is_active: true,
          }))
        );
      return upsertAvailability(selectedPro, slots);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', selectedPro] });
      toast.success('Horarios guardados');
    },
    onError: () => toast.error('Error al guardar horarios'),
  });

  const addBlockedMut = useMutation({
    mutationFn: (data: BlockedForm) => {
      const start = data.is_all_day
        ? `${data.start_time}T00:00:00`
        : `${data.start_time}T00:00:00`;
      const end = data.is_all_day
        ? `${data.end_time}T23:59:59`
        : `${data.end_time}T23:59:59`;
      return createBlockedDate({
        professional_id: selectedPro,
        start_time: start,
        end_time: end,
        reason: data.reason || null,
        is_recurring: false,
        recurrence_rule: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-dates', selectedPro] });
      toast.success('Fecha bloqueada');
      setBlockedModal(false);
      setBlockedForm({ start_time: '', end_time: '', reason: '', is_all_day: true });
    },
    onError: () => toast.error('Error al bloquear fecha'),
  });

  const removeBlockedMut = useMutation({
    mutationFn: (id: string) => deleteBlockedDate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-dates', selectedPro] });
      toast.success('Fecha desbloqueada');
    },
    onError: () => toast.error('Error al desbloquear fecha'),
  });

  const handleProChange = (proId: string) => {
    setSelectedPro(proId);
    const avail = availabilityData;
    if (avail.length > 0) {
      const grouped: Record<number, { start_time: string; end_time: string }[]> = {};
      avail.forEach((a: Availability) => {
        if (!grouped[a.day_of_week]) grouped[a.day_of_week] = [];
        grouped[a.day_of_week].push({ start_time: a.start_time, end_time: a.end_time });
      });
      setSchedule(
        DAYS.map((d) => ({
          day_of_week: d.value,
          is_active: !!grouped[d.value]?.length,
          blocks: grouped[d.value]?.length
            ? grouped[d.value]
            : [{ start_time: '09:00', end_time: '18:00' }],
        }))
      );
    } else {
      setSchedule(buildEmptySchedule());
    }
  };

  const toggleDay = (day: number) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day_of_week === day ? { ...d, is_active: !d.is_active } : d))
    );
  };

  const updateBlock = (day: number, index: number, field: 'start_time' | 'end_time', value: string) => {
    setSchedule((prev) =>
      prev.map((d) =>
        d.day_of_week === day
          ? {
              ...d,
              blocks: d.blocks.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
            }
          : d
      )
    );
  };

  const addBlock = (day: number) => {
    setSchedule((prev) =>
      prev.map((d) =>
        d.day_of_week === day
          ? { ...d, blocks: [...d.blocks, { start_time: '09:00', end_time: '18:00' }] }
          : d
      )
    );
  };

  const removeBlock = (day: number, index: number) => {
    setSchedule((prev) =>
      prev.map((d) =>
        d.day_of_week === day
          ? { ...d, blocks: d.blocks.filter((_, i) => i !== index) }
          : d
      )
    );
  };

  if (loadingPros) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Horarios de disponibilidad</h1>
      </div>

      <Select
        label="Seleccionar profesional"
        value={selectedPro}
        onChange={(e) => handleProChange(e.target.value)}
        options={professionals.map((p) => ({ value: p.id, label: p.full_name }))}
        placeholder="Seleccionar..."
      />

      {selectedPro && (
        <>
          {loadingAvail ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-3">
              {DAYS.map((day) => {
                const ds = schedule.find((d) => d.day_of_week === day.value)!;
                return (
                  <Card key={day.value} padding="sm">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          ds.is_active ? 'bg-[#DC2626]' : 'bg-[#333]'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            ds.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className="text-sm font-medium text-white w-28">{day.label}</span>
                      {ds.is_active && (
                        <div className="flex-1 flex flex-wrap items-center gap-2">
                          {ds.blocks.map((block, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <input
                                type="time"
                                value={block.start_time}
                                onChange={(e) => updateBlock(day.value, idx, 'start_time', e.target.value)}
                                className="rounded-lg border border-[#333] bg-[#080808] text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50"
                              />
                              <span className="text-[#9CA3AF]">—</span>
                              <input
                                type="time"
                                value={block.end_time}
                                onChange={(e) => updateBlock(day.value, idx, 'end_time', e.target.value)}
                                className="rounded-lg border border-[#333] bg-[#080808] text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50"
                              />
                              {ds.blocks.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeBlock(day.value, idx)}
                                  className="p-1 text-[#9CA3AF] hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => addBlock(day.value)}>
                            Bloque
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
              <div className="flex justify-end pt-2">
                <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
                  Guardar horarios
                </Button>
              </div>
            </div>
          )}

          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Fechas bloqueadas</h2>
              <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setBlockedModal(true)}>
                Bloquear fecha
              </Button>
            </div>
            {loadingBlocked ? (
              <LoadingSpinner />
            ) : blockedDates.length === 0 ? (
              <Card className="text-center py-8">
                <CalendarOff size={32} className="mx-auto text-[#9CA3AF] mb-3" />
                <p className="text-sm text-[#9CA3AF]">No hay fechas bloqueadas</p>
              </Card>
            ) : (
              <Card padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#333]">
                        <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Desde</th>
                        <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Hasta</th>
                        <th className="text-left px-5 py-3 font-medium text-[#9CA3AF] hidden sm:table-cell">Motivo</th>
                        <th className="text-right px-5 py-3 font-medium text-[#9CA3AF]">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockedDates.map((bd: BlockedDate) => (
                        <tr key={bd.id} className="border-b border-[#333]/50 last:border-0">
                          <td className="px-5 py-3 text-white">
                            {new Date(bd.start_time).toLocaleDateString('es-AR')}
                          </td>
                          <td className="px-5 py-3 text-white">
                            {new Date(bd.end_time).toLocaleDateString('es-AR')}
                          </td>
                          <td className="px-5 py-3 text-[#9CA3AF] hidden sm:table-cell">{bd.reason ?? '—'}</td>
                          <td className="px-5 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 size={15} />}
                              onClick={() => removeBlockedMut.mutate(bd.id)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      <Modal isOpen={blockedModal} onClose={() => setBlockedModal(false)} title="Bloquear fecha" maxWidth="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!blockedForm.start_time || !blockedForm.end_time) {
              toast.error('Seleccioná las fechas');
              return;
            }
            addBlockedMut.mutate(blockedForm);
          }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={() => setBlockedForm({ ...blockedForm, is_all_day: !blockedForm.is_all_day })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                blockedForm.is_all_day ? 'bg-[#DC2626]' : 'bg-[#333]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  blockedForm.is_all_day ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-white">Todo el día</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fecha inicio"
              type="date"
              value={blockedForm.start_time}
              onChange={(e) => setBlockedForm({ ...blockedForm, start_time: e.target.value })}
            />
            <Input
              label="Fecha fin"
              type="date"
              value={blockedForm.end_time}
              onChange={(e) => setBlockedForm({ ...blockedForm, end_time: e.target.value })}
            />
          </div>
          <Textarea
            label="Motivo"
            value={blockedForm.reason}
            onChange={(e) => setBlockedForm({ ...blockedForm, reason: e.target.value })}
            placeholder="Ej: Vacaciones, feriado..."
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setBlockedModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={addBlockedMut.isPending}>
              Bloquear
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
