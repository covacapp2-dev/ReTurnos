import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Calendar, Clock, User, Building2 } from 'lucide-react';
import { getBusinessBySlug } from '../../services/business';

export default function PublicBookingSuccessPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [showCheck, setShowCheck] = useState(false);

  const servicio = searchParams.get('servicio') || '';
  const profesional = searchParams.get('profesional') || '';
  const fecha = searchParams.get('fecha') || '';
  const hora = searchParams.get('hora') || '';

  const { data: business } = useQuery({
    queryKey: ['business-slug', slug],
    queryFn: () => getBusinessBySlug(slug!),
    enabled: !!slug,
    select: (res) => res.data,
  });

  useEffect(() => {
    const timer = setTimeout(() => setShowCheck(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const formattedDate = fecha
    ? format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es })
    : '';

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8 py-12">
        <div className="relative inline-flex">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-700 ${
              showCheck
                ? 'bg-emerald-500/20 scale-100 opacity-100'
                : 'bg-emerald-500/0 scale-50 opacity-0'
            }`}
          >
            <CheckCircle2
              size={64}
              className={`text-emerald-500 transition-all duration-700 ${
                showCheck ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
              }`}
            />
          </div>
          <div
            className={`absolute inset-0 rounded-full border-2 border-emerald-500/30 transition-all duration-1000 ${
              showCheck ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
            }`}
          />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">
            ¡Reserva confirmada!
          </h1>
          <p className="text-[#9CA3AF] text-sm">
            Tu turno fue registrado exitosamente.
          </p>
        </div>

        {business && (
          <div className="rounded-xl border border-[#333] bg-[#1A1A1A] p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#DC2626] flex items-center justify-center text-white shrink-0">
                <Building2 size={18} />
              </div>
              <div className="text-left">
                <div className="text-xs text-[#9CA3AF]">Negocio</div>
                <div className="text-white font-semibold text-sm">{business.name}</div>
              </div>
            </div>

            <div className="h-px bg-[#333]" />

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#DC2626] flex items-center justify-center text-white shrink-0">
                <Calendar size={18} />
              </div>
              <div className="text-left">
                <div className="text-xs text-[#9CA3AF]">Servicio</div>
                <div className="text-white font-semibold text-sm">{servicio}</div>
              </div>
            </div>

            {profesional && (
              <>
                <div className="h-px bg-[#333]" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#DC2626] flex items-center justify-center text-white shrink-0">
                    <User size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-[#9CA3AF]">Profesional</div>
                    <div className="text-white font-semibold text-sm">{profesional}</div>
                  </div>
                </div>
              </>
            )}

            <div className="h-px bg-[#333]" />

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#DC2626] flex items-center justify-center text-white shrink-0">
                <Clock size={18} />
              </div>
              <div className="text-left">
                <div className="text-xs text-[#9CA3AF]">Fecha y hora</div>
                <div className="text-white font-semibold text-sm capitalize">{formattedDate}</div>
                <div className="text-[#9CA3AF] text-xs">{hora} hs</div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Link
            to={`/reserva/${slug}`}
            className="block w-full px-4 py-3 rounded-xl bg-[#DC2626] text-white hover:bg-[#B91C1C] active:bg-[#991B1B] transition-colors text-sm font-semibold text-center"
          >
            Volver al inicio
          </Link>
        </div>

        <p className="text-[#9CA3AF] text-xs">
          Powered by{' '}
          <span className="text-[#DC2626] font-semibold">ReTurnos</span>
        </p>
      </div>
    </div>
  );
}
