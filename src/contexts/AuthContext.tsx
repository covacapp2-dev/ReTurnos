import { createContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { fetchModeSubscriptions } from '../services/modeSubscriptions';

export const AuthContext = createContext<null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, setProfile, setBusiness, setModeSubs, setLoading, logout } = useAuthStore();
  const businessId = useAuthStore((s) => s.business?.id);

  useEffect(() => {
    async function getInitialSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfileAndBusiness(session.user.id);
        }
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    }

    async function fetchProfileAndBusiness(userId: string) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      setProfile(profile ?? null);

      if (profile) {
        const { data: membership } = await supabase
          .from('business_members')
          .select('business_id')
          .eq('user_id', userId)
          .single();

        if (membership) {
          const { data: business } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', membership.business_id)
            .single();

          setBusiness(business ?? null);
        } else {
          // Fallback: negocio propio sin fila de membresía todavía
          const { data: ownedBusiness } = await supabase
            .from('businesses')
            .select('*')
            .eq('owner_id', userId)
            .maybeSingle();

          setBusiness(ownedBusiness ?? null);
        }
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfileAndBusiness(session.user.id);
        } else {
          setProfile(null);
          setBusiness(null);
        }

        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setProfile, setBusiness, setLoading, logout]);

  // Suscripción de cada sistema (general / sports) por separado
  useEffect(() => {
    if (!businessId) {
      setModeSubs([]);
      return;
    }

    let cancelled = false;
    fetchModeSubscriptions(businessId).then((subs) => {
      if (!cancelled) setModeSubs(subs);
    });

    return () => {
      cancelled = true;
    };
  }, [businessId, setModeSubs]);

  return (
    <AuthContext.Provider value={null}>
      {children}
    </AuthContext.Provider>
  );
}
