import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  BookOpen,
  Video,
  Send,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const faqItems = [
  {
    question: '¿Cómo creo un servicio?',
    answer:
      'Desde el menú lateral, hacé clic en "Servicios" y luego en "Nuevo servicio". Completá el nombre, duración, precio y descripción. Podés asignar colores para identificarlos fácilmente en la agenda.',
  },
  {
    question: '¿Cómo configuro mis horarios?',
    answer:
      'Andá a "Horarios" desde el menú lateral. Ahí podés definir los días y horarios de atención de cada profesional. Podés configurar horarios diferentes por día y establecer pausas para almuerzo u otras actividades.',
  },
  {
    question: '¿Cómo comparto el link de reservas?',
    answer:
      'En la sección de "Ajustes" encontrás un link público de reservas. Copialo y compartilo por WhatsApp, email o redes sociales. Tus clientes podrán reservarTurnos sin necesidad de crear cuenta.',
  },
  {
    question: '¿Cómo cancelo una reserva?',
    answer:
      'Entrá al detalle de la reserva desde la agenda o la lista de reservas. Hacé clic en "Cancelar reserva" y confirmá la acción. Se notificará automáticamente al cliente por email si configuraste esa opción.',
  },
  {
    question: '¿Cómo funcionan las suscripciones?',
    answer:
      'ReTurnos ofrece planes mensuales según la cantidad de profesionales y sucursales. Elegí el plan que mejor se adapte a tu negocio. Podés cancelar en cualquier momento sin penalidades.',
  },
  {
    question: '¿Puedo tener varias sucursales?',
    answer:
      'Sí, podés crear múltiples sucursales desde "Sucursales". Cada una tiene su propia agenda, profesionales y configuración. Ideal para negocios con varias ubicaciones.',
  },
];

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[#333] last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <span className="text-sm font-medium text-white pr-4">{question}</span>
        {isOpen ? (
          <ChevronUp size={18} className="text-[#9CA3AF] shrink-0" />
        ) : (
          <ChevronDown size={18} className="text-[#9CA3AF] shrink-0" />
        )}
      </button>
      {isOpen && (
        <p className="text-sm text-[#9CA3AF] pb-4 leading-relaxed">{answer}</p>
      )}
    </div>
  );
}

export default function SupportPage({ embedded = false }: { embedded?: boolean }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  const handleSubmitContact = () => {
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      toast.error('Completá todos los campos obligatorios');
      return;
    }
    toast.success('Mensaje enviado. Te responderemos a la brevedad.');
    setContactName('');
    setContactEmail('');
    setContactSubject('');
    setContactMessage('');
  };

  return (
    <div
      className={
        embedded ? '' : 'min-h-screen bg-[#080808] p-4 md:p-6 max-w-2xl mx-auto'
      }
    >
      {!embedded && (
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Centro de ayuda</h1>
      )}
      <p className="text-sm text-[#9CA3AF] mb-6">Encontrá respuestas a las preguntas más frecuentes</p>

      {/* FAQ Section */}
      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <HelpCircle size={20} className="text-[#DC2626]" />
        Preguntas frecuentes
      </h2>
      <Card className="mb-6">
        {faqItems.map((item, index) => (
          <FaqItem
            key={index}
            question={item.question}
            answer={item.answer}
            isOpen={openFaq === index}
            onToggle={() => setOpenFaq(openFaq === index ? null : index)}
          />
        ))}
      </Card>

      {/* Contact Section */}
      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <Mail size={20} className="text-[#DC2626]" />
        Contacto
      </h2>
      <Card className="mb-6">
        <p className="text-sm text-[#9CA3AF] mb-4">
          ¿No encontraste lo que buscás? Escribinos a{' '}
          <span className="text-[#DC2626] font-medium">soporte@returnos.com</span>
        </p>
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Tu nombre"
          />
          <Input
            label="Email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="tu@email.com"
            icon={Mail}
          />
          <Input
            label="Asunto"
            value={contactSubject}
            onChange={(e) => setContactSubject(e.target.value)}
            placeholder="¿En qué podemos ayudarte?"
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-white mb-1.5">Mensaje</label>
            <textarea
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              placeholder="Describí tu consulta..."
              rows={4}
              className="w-full rounded-lg border border-[#333] bg-[#1A1A1A] text-white placeholder:text-[#9CA3AF] px-3 py-2.5 text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#DC2626]/50 focus:border-[#DC2626] resize-none"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmitContact} icon={<Send size={16} />}>
              Enviar mensaje
            </Button>
          </div>
        </div>
      </Card>

      {/* Resources */}
      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <BookOpen size={20} className="text-[#DC2626]" />
        Recursos
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="flex items-center gap-4 cursor-pointer hover:border-[#DC2626]/50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-[#DC2626]/10 flex items-center justify-center shrink-0">
            <BookOpen size={20} className="text-[#DC2626]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Documentación</p>
            <p className="text-xs text-[#9CA3AF]">Guías y tutoriales detallados</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 cursor-pointer hover:border-[#DC2626]/50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-[#DC2626]/10 flex items-center justify-center shrink-0">
            <Video size={20} className="text-[#DC2626]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Video tutoriales</p>
            <p className="text-xs text-[#9CA3AF]">Aprende viendo paso a paso</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
