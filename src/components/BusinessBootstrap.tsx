import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { createBusiness } from '../services/business';
import { supabase } from '../lib/supabase';
import Button from './ui/Button';

// Primera entrada: crea el negocio solo, sin preguntar nada,
// y deja al usuario directo en el Inicio.
export default function BusinessBootstrap() {
  const { user, setBusiness } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        // 1) ¿Ya tiene un negocio? (por owner o por membresía)
        const { data: existing } = await supabase
          .from('businesses')
          .select('*')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (existing) {
          if (!cancelled) setBusiness(existing);
          return;
        }

        // 2) Lo crea con un nombre genérico (se puede cambiar en Configuración)
        const slug = `negocio-${Date.now().toString(36)}`;
        const trialEnds = new Date();
        trialEnds.setMonth(trialEnds.getMonth() + 3); // 3 meses gratis
        const res = await createBusiness({
          owner_id: user.id,
          name: 'Mi negocio',
          slug,
          logo_url: null,
          description: null,
          phone: null,
          email: user.email ?? null,
          address: null,
          timezone: 'America/Argentina/Buenos_Aires',
          currency: 'ARS',
          business_type: null,
          subscription_status: 'trial',
          trial_started_at: new Date().toISOString(),
          trial_ends_at: trialEnds.toISOString(),
          subscription_started_at: null,
          subscription_ends_at: null,
        });

        if (res.error || !res.data) {
          throw new Error(res.error?.message || 'No se pudo crear el negocio');
        }

        // 3) Membresía del dueño (por si no hay trigger en la base)
        await supabase.from('business_members').upsert(
          {
            business_id: res.data.id,
            user_id: user.id,
            role: 'owner',
          },
          { onConflict: 'business_id,user_id', ignoreDuplicates: true }
        );

        if (!cancelled) setBusiness(res.data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al preparar tu cuenta');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, setBusiness, attempt]);

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <h2 className="text-lg font-semibold text-white">No pudimos preparar tu cuenta</h2>
        <p className="text-sm text-[#9CA3AF]">{error}</p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => setAttempt((a) => a + 1)}>Reintentar</Button>
          <Link
            to="/onboarding"
            className="text-sm text-[#DC2626] hover:text-[#EF4444] font-medium"
          >
            Configurar mi negocio a mano
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-9 h-9 border-2 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-[#9CA3AF]">Preparando tu inicio…</p>
    </div>
  );
}
