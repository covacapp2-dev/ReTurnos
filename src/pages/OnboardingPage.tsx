import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Dumbbell,
  Heart,
  Scissors,
  Utensils,
  Wrench,
  GraduationCap,
  Car,
  Briefcase,
  MoreHorizontal,
  Plus,
  Trash2,
  Clock,
  User,
  Upload,
  ExternalLink,
  LayoutDashboard,
} from 'lucide-react';
import { createBusiness } from '../services/business';
import { createService } from '../services/services';
import { createProfessional } from '../services/professionals';
import { createResource } from '../services/resources';
import { upsertAvailability } from '../services/availability';
import { useAuth } from '../hooks/useAuth';

const TOTAL_STEPS = 7;

const CATEGORIES = [
  { id: 'sports', label: 'Deportes', icon: Dumbbell },
  { id: 'health', label: 'Salud', icon: Heart },
  { id: 'beauty', label: 'Belleza', icon: Scissors },
  { id: 'food', label: 'Gastronomía', icon: Utensils },
  { id: 'services', label: 'Servicios', icon: Wrench },
  { id: 'education', label: 'Educación', icon: GraduationCap },
  { id: 'automotive', label: 'Automotor', icon: Car },
  { id: 'professional', label: 'Profesional', icon: Briefcase },
  { id: 'other', label: 'Otro', icon: MoreHorizontal },
];

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface ServiceForm {
  name: string;
  duration: string;
  price: string;
}

interface ProfessionalForm {
  name: string;
  specialty: string;
}

interface ResourceForm {
  name: string;
  type: string;
}

interface ScheduleDay {
  active: boolean;
  start: string;
  end: string;
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [services, setServices] = useState<ServiceForm[]>([{ name: '', duration: '30', price: '' }]);
  const [professionals, setProfessionals] = useState<ProfessionalForm[]>([]);
  const [resources, setResources] = useState<ResourceForm[]>([]);
  const [schedule, setSchedule] = useState<ScheduleDay[]>(
    Array.from({ length: 7 }, (_, i) => ({
      active: i >= 1 && i <= 5,
      start: '09:00',
      end: '18:00',
    }))
  );
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [bookingSlug, setBookingSlug] = useState('');
  const [copied, setCopied] = useState(false);

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const createAllMutation = useMutation({
    mutationFn: async () => {
      const slug = slugify(businessName);

      const bizRes = await createBusiness({
        owner_id: user?.id ?? '',
        name: businessName,
        slug,
        logo_url: null,
        description: null,
        phone: null,
        email: null,
        address: null,
        timezone: 'America/Argentina/Buenos_Aires',
        currency: 'ARS',
        business_type: category,
        subscription_status: 'trial',
        trial_started_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        subscription_started_at: null,
        subscription_ends_at: null,
      });

      if (bizRes.error || !bizRes.data) throw new Error(bizRes.error?.message || 'Error al crear negocio');
      const bizId = bizRes.data.id;
      setBusinessId(bizId);
      setBookingSlug(slug);

      const createdProfessionalIds: string[] = [];
      for (const p of professionals.filter((p) => p.name.trim())) {
        const profRes = await createProfessional({
          business_id: bizId,
          branch_id: null,
          user_id: null,
          full_name: p.name,
          email: null,
          phone: null,
          avatar_url: null,
          bio: p.specialty || null,
          is_active: true,
        });
        if (profRes.error) throw new Error(profRes.error.message);
        if (profRes.data) {
          createdProfessionalIds.push(profRes.data.id);
        }
      }

      for (const s of services.filter((s) => s.name.trim())) {
        const svcRes = await createService({
          business_id: bizId,
          branch_id: null,
          name: s.name,
          description: null,
          duration_minutes: parseInt(s.duration) || 30,
          price: parseFloat(s.price) || 0,
          currency: 'ARS',
          color: null,
          is_active: true,
          allows_online_booking: true,
          max_advance_days: 30,
          min_advance_minutes: 30,
        });
        if (svcRes.error) throw new Error(svcRes.error.message);
      }

      for (const r of resources.filter((r) => r.name.trim())) {
        const resRes = await createResource({
          business_id: bizId,
          branch_id: null,
          name: r.name,
          type: (r.type as any) || 'other',
          description: null,
          is_active: true,
        });
        if (resRes.error) throw new Error(resRes.error.message);
      }

      for (const profId of createdProfessionalIds) {
        const slots = schedule
          .map((day, i) => ({
            day_of_week: i,
            start_time: day.start,
            end_time: day.end,
            is_active: day.active,
          }))
          .filter((s) => s.is_active);

        const availRes = await upsertAvailability(profId, slots);
        if (availRes.error) throw new Error(availRes.error.message);
      }

      return bizRes.data;
    },
    onSuccess: () => {
      setStep(6);
      toast.success('¡Negocio creado exitosamente!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al crear el negocio');
    },
  });

  const canAdvance = () => {
    switch (step) {
      case 0:
        return businessName.trim().length >= 2;
      case 1:
        return !!category;
      case 2:
        return services.some((s) => s.name.trim());
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (step === 5) {
      createAllMutation.mutate();
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const addService = () => setServices([...services, { name: '', duration: '30', price: '' }]);
  const removeService = (i: number) => setServices(services.filter((_, idx) => idx !== i));
  const updateService = (i: number, field: keyof ServiceForm, value: string) =>
    setServices(services.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));

  const addProfessional = () => setProfessionals([...professionals, { name: '', specialty: '' }]);
  const removeProfessional = (i: number) => setProfessionals(professionals.filter((_, idx) => idx !== i));
  const updateProfessional = (i: number, field: keyof ProfessionalForm, value: string) =>
    setProfessionals(professionals.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));

  const addResource = () => setResources([...resources, { name: '', type: 'other' }]);
  const removeResource = (i: number) => setResources(resources.filter((_, idx) => idx !== i));
  const updateResource = (i: number, field: keyof ResourceForm, value: string) =>
    setResources(resources.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const toggleDay = (i: number) =>
    setSchedule(schedule.map((d, idx) => (idx === i ? { ...d, active: !d.active } : d)));

  const updateSchedule = (i: number, field: 'start' | 'end', value: string) =>
    setSchedule(schedule.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)));

  const copyLink = () => {
    const url = `${window.location.origin}/book/${bookingSlug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copiado');
  };

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-[#DC2626]/20 flex items-center justify-center mx-auto">
                <Briefcase size={32} className="text-[#DC2626]" />
              </div>
              <h2 className="text-2xl font-bold text-white">¿Cómo se llama tu negocio?</h2>
              <p className="text-[#9CA3AF] text-sm">
                Este nombre será visible para tus clientes.
              </p>
            </div>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej: Peluquería Style"
              autoFocus
              className="w-full rounded-xl border border-[#333] bg-[#1A1A1A] text-white placeholder:text-[#9CA3AF] px-4 py-3.5 text-base text-center focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
            />
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-[#DC2626]/20 flex items-center justify-center mx-auto">
                <Wrench size={32} className="text-[#DC2626]" />
              </div>
              <h2 className="text-2xl font-bold text-white">¿Qué tipo de negocio tenés?</h2>
              <p className="text-[#9CA3AF] text-sm">
                Elegí la categoría que mejor represente tu actividad.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                      category === cat.id
                        ? 'border-[#DC2626] bg-[#DC2626]/10 ring-1 ring-[#DC2626]/50'
                        : 'border-[#333] bg-[#1A1A1A] hover:border-[#555]'
                    }`}
                  >
                    <Icon
                      size={24}
                      className={category === cat.id ? 'text-[#DC2626]' : 'text-[#9CA3AF]'}
                    />
                    <span
                      className={`text-xs font-medium ${
                        category === cat.id ? 'text-[#DC2626]' : 'text-[#9CA3AF]'
                      }`}
                    >
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-[#DC2626]/20 flex items-center justify-center mx-auto">
                <Clock size={32} className="text-[#DC2626]" />
              </div>
              <h2 className="text-2xl font-bold text-white">¿Qué servicios ofrecés?</h2>
              <p className="text-[#9CA3AF] text-sm">
                Agregá al menos un servicio para que tus clientes puedan reservar.
              </p>
            </div>
            <div className="space-y-3">
              {services.map((s, i) => (
                <div key={i} className="rounded-xl border border-[#333] bg-[#1A1A1A] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">Servicio {i + 1}</span>
                    {services.length > 1 && (
                      <button
                        onClick={() => removeService(i)}
                        className="p-1 rounded-lg text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => updateService(i, 'name', e.target.value)}
                    placeholder="Nombre del servicio"
                    className="w-full rounded-lg border border-[#333] bg-[#080808] text-white placeholder:text-[#9CA3AF] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#9CA3AF] mb-1">Duración (min)</label>
                      <input
                        type="number"
                        value={s.duration}
                        onChange={(e) => updateService(i, 'duration', e.target.value)}
                        min="5"
                        step="5"
                        className="w-full rounded-lg border border-[#333] bg-[#080808] text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#9CA3AF] mb-1">Precio ($)</label>
                      <input
                        type="number"
                        value={s.price}
                        onChange={(e) => updateService(i, 'price', e.target.value)}
                        min="0"
                        className="w-full rounded-lg border border-[#333] bg-[#080808] text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={addService}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#333] bg-transparent text-[#9CA3AF] hover:text-white hover:border-[#555] transition-colors py-3 text-sm font-medium"
              >
                <Plus size={16} />
                Agregar servicio
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-[#DC2626]/20 flex items-center justify-center mx-auto">
                <User size={32} className="text-[#DC2626]" />
              </div>
              <h2 className="text-2xl font-bold text-white">Agregá tus profesionales/recursos</h2>
              <p className="text-[#9CA3AF] text-sm">
                Opcional: podés saltar este paso y agregar después.
              </p>
            </div>

            <div>
              <h3 className="text-white font-semibold text-sm mb-3">Profesionales</h3>
              <div className="space-y-3">
                {professionals.map((p, i) => (
                  <div key={i} className="rounded-xl border border-[#333] bg-[#1A1A1A] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-medium">Profesional {i + 1}</span>
                      <button
                        onClick={() => removeProfessional(i)}
                        className="p-1 rounded-lg text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => updateProfessional(i, 'name', e.target.value)}
                      placeholder="Nombre completo"
                      className="w-full rounded-lg border border-[#333] bg-[#080808] text-white placeholder:text-[#9CA3AF] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
                    />
                    <input
                      type="text"
                      value={p.specialty}
                      onChange={(e) => updateProfessional(i, 'specialty', e.target.value)}
                      placeholder="Especialidad (opcional)"
                      className="w-full rounded-lg border border-[#333] bg-[#080808] text-white placeholder:text-[#9CA3AF] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
                    />
                  </div>
                ))}
                <button
                  onClick={addProfessional}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#333] bg-transparent text-[#9CA3AF] hover:text-white hover:border-[#555] transition-colors py-3 text-sm font-medium"
                >
                  <Plus size={16} />
                  Agregar profesional
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold text-sm mb-3">Recursos</h3>
              <div className="space-y-3">
                {resources.map((r, i) => (
                  <div key={i} className="rounded-xl border border-[#333] bg-[#1A1A1A] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-medium">Recurso {i + 1}</span>
                      <button
                        onClick={() => removeResource(i)}
                        className="p-1 rounded-lg text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={r.name}
                      onChange={(e) => updateResource(i, 'name', e.target.value)}
                      placeholder="Nombre del recurso"
                      className="w-full rounded-lg border border-[#333] bg-[#080808] text-white placeholder:text-[#9CA3AF] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626]"
                    />
                    <select
                      value={r.type}
                      onChange={(e) => updateResource(i, 'type', e.target.value)}
                      className="w-full rounded-lg border border-[#333] bg-[#080808] text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626] appearance-none"
                    >
                      <option value="room">Sala/Cuarto</option>
                      <option value="equipment">Equipamiento</option>
                      <option value="vehicle">Vehículo</option>
                      <option value="table">Mesa</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                ))}
                <button
                  onClick={addResource}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#333] bg-transparent text-[#9CA3AF] hover:text-white hover:border-[#555] transition-colors py-3 text-sm font-medium"
                >
                  <Plus size={16} />
                  Agregar recurso
                </button>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-[#DC2626]/20 flex items-center justify-center mx-auto">
                <Clock size={32} className="text-[#DC2626]" />
              </div>
              <h2 className="text-2xl font-bold text-white">Configurá tus horarios</h2>
              <p className="text-[#9CA3AF] text-sm">
                Definí los días y horarios de atención de tu negocio.
              </p>
            </div>
            <div className="space-y-2">
              {DAYS.map((dayLabel, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-3 transition-colors ${
                    schedule[i].active
                      ? 'border-[#DC2626]/30 bg-[#1A1A1A]'
                      : 'border-[#333] bg-[#1A1A1A] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleDay(i)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${
                        schedule[i].active ? 'bg-[#DC2626]' : 'bg-[#333]'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          schedule[i].active ? 'translate-x-4.5 left-0' : 'left-0.5'
                        }`}
                        style={{ transform: `translateX(${schedule[i].active ? '18px' : '2px'})` }}
                      />
                    </button>
                    <span className="text-white text-sm font-medium w-10">{dayLabel}</span>
                    {schedule[i].active ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={schedule[i].start}
                          onChange={(e) => updateSchedule(i, 'start', e.target.value)}
                          className="rounded-lg border border-[#333] bg-[#080808] text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50"
                        />
                        <span className="text-[#9CA3AF] text-xs">a</span>
                        <input
                          type="time"
                          value={schedule[i].end}
                          onChange={(e) => updateSchedule(i, 'end', e.target.value)}
                          className="rounded-lg border border-[#333] bg-[#080808] text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50"
                        />
                      </div>
                    ) : (
                      <span className="text-[#9CA3AF] text-xs flex-1">Cerrado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-[#DC2626]/20 flex items-center justify-center mx-auto">
                <Upload size={32} className="text-[#DC2626]" />
              </div>
              <h2 className="text-2xl font-bold text-white">Agregá tu logo</h2>
              <p className="text-[#9CA3AF] text-sm">
                Opcional: podés subirlo después desde el panel de configuración.
              </p>
            </div>
            <div className="rounded-xl border-2 border-dashed border-[#333] bg-[#1A1A1A] p-8 text-center hover:border-[#555] transition-colors cursor-pointer">
              <Upload size={40} className="mx-auto text-[#9CA3AF] mb-3" />
              <p className="text-[#9CA3AF] text-sm">
                Arrastrá tu logo aquí o hacé click para seleccionar
              </p>
              <p className="text-[#9CA3AF] text-xs mt-1">PNG, JPG · Máx 2MB</p>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <Check size={40} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-white">¡Todo listo!</h2>
              <p className="text-[#9CA3AF] text-sm">
                Tu negocio está configurado. Compartí este link con tus clientes para que puedan reservar online.
              </p>
            </div>

            <div className="rounded-xl border border-[#333] bg-[#1A1A1A] p-4 space-y-3">
              <label className="text-xs text-[#9CA3AF] font-medium">Link de reserva pública</label>
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg border border-[#333] bg-[#080808] px-3 py-2.5 text-white text-sm truncate">
                  {window.location.origin}/book/{bookingSlug}
                </div>
                <button
                  onClick={copyLink}
                  className="px-3 py-2 rounded-lg bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors text-sm font-medium flex items-center gap-1.5"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <a
                href={`/book/${bookingSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#333] bg-[#1A1A1A] text-white hover:bg-[#222] transition-colors text-sm font-medium"
              >
                <ExternalLink size={16} />
                Ver página de reserva
              </a>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors text-sm font-semibold"
              >
                <LayoutDashboard size={16} />
                Ir al dashboard
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#080808]">
      <div className="max-w-lg mx-auto px-4 py-6 min-h-screen flex flex-col">
        {step > 0 && step < 6 && (
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-[#1A1A1A] text-[#9CA3AF] hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <div className="h-2 rounded-full bg-[#333] overflow-hidden">
                <div
                  className="h-full bg-[#DC2626] rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <span className="text-[#9CA3AF] text-xs font-medium">
              {step}/{TOTAL_STEPS - 2}
            </span>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center">{renderStep()}</div>

        {step < 6 && (
          <div className="mt-8 pb-4">
            <button
              onClick={handleNext}
              disabled={!canAdvance() || createAllMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#DC2626] text-white hover:bg-[#B91C1C] active:bg-[#991B1B] transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createAllMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : step === 5 ? (
                <>
                  <Check size={16} />
                  Crear mi negocio
                </>
              ) : step === 0 || step === 1 ? (
                <>
                  Comenzar
                  <ArrowRight size={16} />
                </>
              ) : (
                <>
                  {step === 2 || step === 3 || step === 4 ? 'Omitir' : 'Siguiente'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            {step > 0 && step < 5 && (
              <button
                onClick={() => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))}
                className="w-full mt-2 px-4 py-2.5 rounded-xl text-[#9CA3AF] hover:text-white text-sm font-medium transition-colors"
              >
                Omitir este paso
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
