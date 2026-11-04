import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const { user, profile, business, modeSubs, loading, setBusiness } = useAuthStore();

  return { user, profile, business, modeSubs, loading, setBusiness };
}
