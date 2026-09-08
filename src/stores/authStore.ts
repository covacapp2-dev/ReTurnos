import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Profile, Business } from '../types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  business: Business | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setBusiness: (business: Business | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  business: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setBusiness: (business) => set({ business }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null, profile: null, business: null, loading: false }),
}));
