import { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { updateBusiness } from '../services/business';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import Badge from '../components/ui/Badge';

type SettingsTab = 'general' | 'reservas' | 'horarios' | 'notificaciones' | 'suscripcion' | 'link';

const TABS: { value: SettingsTab; label: string; icon: React.ElementType }[] = [
  { value: 'general', label: 'General', icon: Building2 },
  { value: 'reservas', label: 'Reservas', icon: CalendarDays },
  { value: 'horarios', label: 'Horarios', icon: Clock },
  { value: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { value: 'suscripcion', label: 'Suscripción', icon: CreditCard },
  { value: 'link', label: 'Link público', icon: Link2 },
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
  const { business, setBusiness } = useAuth();
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
    mutationFn: () =>
      updateBusiness(business!.id, {
        name,
        description: description || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        timezone,
        currency,
      }),
    onSuccess: (res) => {
      if (res.data && setBusiness) setBusiness(res.data);
      queryClient.invalidateQueries({ queryKey: ['business'] });
      toast.success('Configuración guardada');
    },
    onError: () => toast.error('Error al guardar'),
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

  const renderLinkTab = () => {
    const publicUrl = `https://re-turnos.vercel.app/book/${business?.slug}`;
    return (
      <div className="space-y-4">
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
          <div className="w-40 h-40 bg-white rounded-lg flex items-center justify-center mx-auto">
            <div className="text-center">
              <div className="w-32 h-32 bg-[#333] rounded flex items-center justify-center">
                <span className="text-xs text-[#9CA3AF]">QR Placeholder</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-[#9CA3AF] text-center mt-2">Escaneá para reservar</p>
        </Card>
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
    }
  };

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
        <div className="flex-1">
          <Card>{renderContent()}</Card>
        </div>
      </div>
    </div>
  );
}
