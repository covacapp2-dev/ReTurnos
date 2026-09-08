import { createContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

export const AuthContext = createContext<null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, setProfile, setBusiness, setLoading, logout } = useAuthStore();

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

  return (
    <AuthContext.Provider value={null}>
      {children}
    </AuthContext.Provider>
  );
}
