import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Building2,
  CalendarDays,
  Clock,
  Bell,
  CreditCard,
  Link2,
  ExternalLink,
  Copy,
  Check,
  Upload,
  Download,
  LayoutGrid,
  Goal,
  User,
  HelpCircle,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../stores/authStore';
import { updateBusiness } from '../services/business';
import { setBookingMode } from '../services/auth';
import AccountPage from './AccountPage';
import SupportPage from './SupportPage';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import Badge from '../components/ui/Badge';

type SettingsTab =
  | 'general'
  | 'reservas'
  | 'horarios'
  | 'notificaciones'
  | 'suscripcion'
  | 'link'
  | 'tipo'
  | 'cuenta'
  | 'soporte';

const TABS: { value: SettingsTab; label: string; icon: React.ElementType }[] = [
  { value: 'general', label: 'General', icon: Building2 },
  { value: 'reservas', label: 'Reservas', icon: CalendarDays },
  { value: 'horarios', label: 'Horarios', icon: Clock },
  { value: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { value: 'suscripcion', label: 'Suscripción', icon: CreditCard },
  { value: 'link', label: 'Link público', icon: Link2 },
  { value: 'tipo', label: 'Tipo de sistema', icon: LayoutGrid },
  { value: 'cuenta', label: 'Mi cuenta', icon: User },
  { value: 'soporte', label: 'Soporte', icon: HelpCircle },
];

const TIMEZONES = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (GMT-3)' },
  { value: 'America/Mexico_City', label: 'México (GMT-6)' },
  { value: 'America/Bogota', label: 'Colombia (GMT-5)' },
  { value: 'America/Santiago', label: 'Chile (GMT-3)' },
  { value: 'America/Lima', label: 'Perú (GMT-5)' },
  { value: 'America/New_York', label: 'EE.UU. Este (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'EE.UU. Oeste (GMT-8)' },
  { value: 'Europe/Madrid', label: 'España (GMT+1)' },
];

const CURRENCIES = [
  { value: 'ARS', label: 'Peso argentino (ARS)' },
  { value: 'USD', label: 'Dólar estadounidense (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'MXN', label: 'Peso mexicano (MXN)' },
  { value: 'COP', label: 'Peso colombiano (COP)' },
  { value: 'CLP', label: 'Peso chileno (CLP)' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '60 minutos' },
  { value: 90, label: '90 minutos' },
  { value: 120, label: '120 minutos' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { business, setBusiness, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [copied, setCopied] = useState(false);

  // General form
  const [name, setName] = useState(business?.name ?? '');
  const [description, setDescription] = useState(business?.description ?? '');
  const [phone, setPhone] = useState(business?.phone ?? '');
  const [email, setEmail] = useState(business?.email ?? '');
  const [address, setAddress] = useState(business?.address ?? '');
  const [timezone, setTimezone] = useState(business?.timezone ?? 'America/Argentina/Buenos_Aires');
  const [currency, setCurrency] = useState(business?.currency ?? 'ARS');
  const [slug, setSlug] = useState(business?.slug ?? '');

  useEffect(() => {
    if (business?.slug) setSlug(business.slug);
  }, [business?.slug]);

  // Reservas form
  const [defaultDuration, setDefaultDuration] = useState(30);
  const [minAdvanceHours, setMinAdvanceHours] = useState(1);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(30);
  const [allowCancellations, setAllowCancellations] = useState(true);
  const [cancellationLimitHours, setCancellationLimitHours] = useState(24);

  // Notifications
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [bookingConfirmation, setBookingConfirmation] = useState(true);
  const [reminder, setReminder] = useState(true);

  const saveGeneralMutation = useMutation({
    mutationFn: async () => {
      const res = await updateBusiness(business!.id, {
        name,
        description: description || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        timezone,
        currency,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data) => {
      if (data && setBusiness) setBusiness(data);
      queryClient.invalidateQueries({ queryKey: ['business'] });
      queryClient.invalidateQueries({ queryKey: ['business-slug'] });
      toast.success('Configuración guardada');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al guardar'),
  });

  const handleCopyLink = async () => {
    const url = `https://re-turnos.vercel.app/book/${business?.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiado');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Error al copiar');
    }
  };

  const qrRef = useRef<HTMLCanvasElement>(null);

  const handleDownloadQr = () => {
    const canvas = qrRef.current;
    if (!canvas) {
      toast.error('No se pudo generar el QR');
      return;
    }
    try {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `qr-${slug || business?.slug || 'turnos'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('QR descargado');
    } catch {
      toast.error('Error al descargar el QR');
    }
  };

  const renderGeneralTab = () => (
    <div className="space-y-4">
      <Input label="Nombre del negocio" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe tu negocio..." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 11 1234-5678" />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@negocio.com" />
      </div>
      <Input label="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Av. Corrientes 1234" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Zona horaria" value={timezone} onChange={(e) => setTimezone(e.target.value)} options={TIMEZONES} />
        <Select label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value)} options={CURRENCIES} />
      </div>
      <div className="border border-[#333] rounded-lg p-4">
        <p className="text-sm text-[#9CA3AF] mb-3">Logo del negocio</p>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl bg-[#333] flex items-center justify-center overflow-hidden">
            {business?.logo_url ? (
              <img src={business.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Upload size={24} className="text-[#9CA3AF]" />
            )}
          </div>
          <div>
            <Button variant="secondary" size="sm" icon={<Upload size={14} />}>
              Subir logo
            </Button>
            <p className="text-xs text-[#9CA3AF] mt-1">PNG, JPG. Máx 2MB</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button loading={saveGeneralMutation.isPending} onClick={() => saveGeneralMutation.mutate()}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );

  const renderReservasTab = () => (
    <div className="space-y-4">
      <Select
        label="Duración por defecto"
        value={defaultDuration}
        onChange={(e) => setDefaultDuration(Number(e.target.value))}
        options={DURATION_OPTIONS}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Antelación mínima (horas)"
          type="number"
          min={0}
          value={minAdvanceHours}
          onChange={(e) => setMinAdvanceHours(Number(e.target.value))}
        />
        <Input
          label="Antelación máxima (días)"
          type="number"
          min={1}
          value={maxAdvanceDays}
          onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
        />
      </div>
      <div className="flex items-center justify-between p-4 bg-[#080808] rounded-lg border border-[#333]">
        <div>
          <p className="text-sm font-medium text-white">Permitir cancelaciones</p>
          <p className="text-xs text-[#9CA3AF]">Los clientes podrán cancelar sus reservas</p>
        </div>
        <button
          type="button"
          onClick={() => setAllowCancellations(!allowCancellations)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            allowCancellations ? 'bg-[#DC2626]' : 'bg-[#333]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              allowCancellations ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      {allowCancellations && (
        <Input
          label="Límite de cancelación (horas antes)"
          type="number"
          min={1}
          value={cancellationLimitHours}
          onChange={(e) => setCancellationLimitHours(Number(e.target.value))}
        />
      )}
      <div className="flex justify-end pt-2">
        <Button onClick={() => toast.success('Configuración de reservas guardada')}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );

  const renderHorariosTab = () => (
    <div className="text-center py-8">
      <Clock size={48} className="mx-auto text-[#DC2626] mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">Gestioná tus horarios</h3>
      <p className="text-sm text-[#9CA3AF] mb-4">
        Configurá los horarios de disponibilidad de cada profesional
      </p>
      <Button onClick={() => navigate('/horarios')} icon={<ExternalLink size={16} />}>
        Ir a Horarios
      </Button>
    </div>
  );

  const renderNotificacionesTab = () => (
    <div className="space-y-3">
      {[
        { label: 'Notificaciones por email', desc: 'Recibir resúmenes por email', value: emailNotifications, toggle: setEmailNotifications },
        { label: 'Confirmación de reserva', desc: 'Notificar al confirmar una reserva', value: bookingConfirmation, toggle: setBookingConfirmation },
        { label: 'Recordatorio de reserva', desc: 'Enviar recordatorio 24h antes', value: reminder, toggle: setReminder },
      ].map((item) => (
        <div key={item.label} className="flex items-center justify-between p-4 bg-[#080808] rounded-lg border border-[#333]">
          <div>
            <p className="text-sm font-medium text-white">{item.label}</p>
            <p className="text-xs text-[#9CA3AF]">{item.desc}</p>
          </div>
          <button
            type="button"
            onClick={() => item.toggle(!item.value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              item.value ? 'bg-[#DC2626]' : 'bg-[#333]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                item.value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <Button onClick={() => toast.success('Notificaciones guardadas')}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );

  const renderSuscripcionTab = () => (
    <div className="space-y-4">
      <Card className="border-[#DC2626]/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Plan actual</h3>
          <Badge variant={business?.subscription_status === 'active' ? 'success' : 'warning'} dot>
            {business?.subscription_status === 'active' ? 'Activo' : 'Prueba'}
          </Badge>
        </div>
        <p className="text-2xl font-bold text-[#DC2626] mb-1">
          {business?.subscription_status === 'trial' ? 'Plan de prueba' : 'Plan Pro'}
        </p>
        {business?.trial_ends_at && (
          <p className="text-sm text-[#9CA3AF]">
            Trial hasta: {new Date(business.trial_ends_at).toLocaleDateString('es-AR')}
          </p>
        )}
        {business?.subscription_started_at && (
          <p className="text-sm text-[#9CA3AF]">
            Inicio: {new Date(business.subscription_started_at).toLocaleDateString('es-AR')}
          </p>
        )}
      </Card>
      <div className="flex justify-end pt-2">
        <Button variant="outline" onClick={() => navigate('/subscription')} icon={<ExternalLink size={16} />}>
          Gestionar suscripción
        </Button>
      </div>
    </div>
  );

  const saveSlugMutation = useMutation({
    mutationFn: async () => {
      const res = await updateBusiness(business!.id, { slug: slug.trim().toLowerCase() });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data) => {
      if (data && setBusiness) setBusiness(data);
      queryClient.invalidateQueries({ queryKey: ['business'] });
      queryClient.invalidateQueries({ queryKey: ['business-slug'] });
      toast.success('Link actualizado');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
        toast.error('Ese link ya está en uso, probá otro');
      } else {
        toast.error(msg || 'Error al actualizar el link');
      }
    },
  });

  const renderLinkTab = () => {
    const publicUrl = `https://re-turnos.vercel.app/book/${slug || business?.slug}`;
    const slugValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3;
    return (
      <div className="space-y-4">
        <Card>
          <p className="text-sm font-medium text-white mb-3">Personalizá tu link</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">Identificador (slug)</label>
              <div className="flex items-center bg-[#080808] border border-[#333] rounded-lg px-3 py-2.5 focus-within:border-[#DC2626] transition-colors">
                <span className="text-xs text-[#9CA3AF] font-mono mr-1 shrink-0">/book/</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="flex-1 bg-transparent text-sm text-white font-mono outline-none min-w-0"
                  placeholder="mi-negocio"
                />
              </div>
              {slug && !slugValid && (
                <p className="text-xs text-[#F87171] mt-1">Mínimo 3 caracteres, solo letras, números y guiones</p>
              )}
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={saveSlugMutation.isPending}
              disabled={!slugValid || slug === business?.slug}
              onClick={() => saveSlugMutation.mutate()}
            >
              Guardar
            </Button>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-2">Si cambiás el link, el anterior deja de funcionar.</p>
        </Card>
        <Card>
          <p className="text-sm text-[#9CA3AF] mb-2">Tu link público de reservas</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#080808] border border-[#333] rounded-lg px-3 py-2.5">
              <p className="text-sm text-white font-mono">{publicUrl}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleCopyLink} icon={copied ? <Check size={14} /> : <Copy size={14} />}>
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.open(publicUrl, '_blank')} icon={<ExternalLink size={14} />}>
              Abrir
            </Button>
          </div>
        </Card>
        <Card>
          <p className="text-sm font-medium text-white mb-3">Código QR</p>
          <div className="w-44 h-44 bg-white rounded-lg flex items-center justify-center mx-auto p-2">
            <QRCodeCanvas
              ref={qrRef}
              value={publicUrl}
              size={160}
              level="M"
              marginSize={1}
              bgColor="#FFFFFF"
              fgColor="#080808"
              title="QR para reservar"
            />
          </div>
          <p className="text-xs text-[#9CA3AF] text-center mt-2">Escaneá para reservar</p>
          <div className="flex justify-center gap-2 mt-3">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleDownloadQr}
            >
              Descargar PNG
            </Button>
          </div>
        </Card>
      </div>
    );
  };

  const bookingMode: 'general' | 'sports' =
    (user?.user_metadata?.booking_mode as string | undefined) === 'sports' ? 'sports' : 'general';

  const setModeMutation = useMutation({
    mutationFn: (mode: 'general' | 'sports') => setBookingMode(mode),
    onSuccess: ({ user: updatedUser, error }) => {
      if (error) throw new Error(error.message);
      if (updatedUser) useAuthStore.getState().setUser(updatedUser);
      toast.success('Tipo de sistema actualizado');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Error al cambiar el tipo de sistema'),
  });

  const renderTipoTab = () => {
    const options: {
      value: 'general' | 'sports';
      label: string;
      description: string;
      icon: React.ElementType;
    }[] = [
      {
        value: 'general',
        label: 'Servicio de turnos en general',
        description: 'Dashboard con servicios, profesionales y clientes de cualquier rubro.',
        icon: CalendarDays,
      },
      {
        value: 'sports',
        label: 'Servicio de turnos complejo deportivo',
        description: 'Lobby con deportes y canchas de fútbol, pádel, tenis, etc.',
        icon: Goal,
      },
    ];

    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-white">¿Cómo querés usar ReTurnos?</p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Al cambiar, tu pantalla de inicio y el menú lateral se adaptan al modo elegido.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((opt) => {
            const selected = bookingMode === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  if (selected || setModeMutation.isPending) return;
                  setModeMutation.mutate(opt.value);
                }}
                className={`text-left rounded-xl border p-4 transition-all ${
                  selected
                    ? 'border-[#DC2626] bg-[#DC2626]/10 ring-1 ring-[#DC2626]/40'
                    : 'border-[#333] bg-[#111] hover:border-[#555]'
                }`}
              >
                <Icon
                  size={22}
                  className={selected ? 'text-[#DC2626] mb-2' : 'text-[#9CA3AF] mb-2'}
                />
                <p className="text-sm font-semibold text-white">{opt.label}</p>
                <p className="text-xs text-[#9CA3AF] mt-1 leading-snug">{opt.description}</p>
                {selected && (
                  <p className="text-[11px] text-[#DC2626] font-medium mt-2">Activo actualmente</p>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-[#9CA3AF]">
          No se pierde nada: las reservas, clientes y productos se mantienen en ambos modos.
        </p>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'general': return renderGeneralTab();
      case 'reservas': return renderReservasTab();
      case 'horarios': return renderHorariosTab();
      case 'notificaciones': return renderNotificacionesTab();
      case 'suscripcion': return renderSuscripcionTab();
      case 'link': return renderLinkTab();
      case 'tipo': return renderTipoTab();
      case 'cuenta': return <AccountPage embedded />;
      case 'soporte': return <SupportPage embedded />;
    }
  };

  const isFullWidthTab = activeTab === 'cuenta' || activeTab === 'soporte';

  return (
    <div className="min-h-screen bg-[#080808] p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Configuración</h1>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Tab Navigation */}
        <div className="lg:w-56 shrink-0">
          <Card padding="sm">
            <nav className="space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.value
                        ? 'bg-[#DC2626] text-white'
                        : 'text-[#9CA3AF] hover:text-white hover:bg-[#333]'
                    }`}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isFullWidthTab ? renderContent() : <Card>{renderContent()}</Card>}
        </div>
      </div>
    </div>
  );
}
