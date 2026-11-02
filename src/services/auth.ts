import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface AuthError {
  message: string;
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  bookingMode?: string
): Promise<{ profile: Profile | null; error: AuthError | null }> {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        booking_mode: bookingMode || 'general',
      },
    },
  });

  if (authError) return { profile: null, error: { message: authError.message } };

  if (authData.user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        full_name: fullName,
      })
      .select()
      .single();

    if (profileError) return { profile: null, error: { message: profileError.message } };
    return { profile, error: null };
  }

  return { profile: null, error: { message: 'No se pudo crear el usuario' } };
}

export async function signIn(
  email: string,
  password: string
): Promise<{ profile: Profile | null; error: AuthError | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { profile: null, error: { message: error.message } };

  if (data.user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select()
      .eq('id', data.user.id)
      .single();

    if (profileError) return { profile: null, error: { message: profileError.message } };
    return { profile, error: null };
  }

  return { profile: null, error: { message: 'No se pudo iniciar sesión' } };
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error ? { message: error.message } : null };
}

// Cambia el tipo de sistema de la cuenta: "general" | "sports"
export async function setBookingMode(
  mode: 'general' | 'sports'
): Promise<{ user: User | null; error: AuthError | null }> {
  const { error } = await supabase.auth.updateUser({
    data: { booking_mode: mode },
  });

  if (error) return { user: null, error: { message: error.message } };

  const {
    data: { user: freshUser },
  } = await supabase.auth.getUser();

  return { user: freshUser, error: null };
}

export async function resetPassword(
  email: string
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error: error ? { message: error.message } : null };
}

export async function getCurrentUser(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select()
    .eq('id', user.id)
    .single();

  return profile;
}

export function onAuthStateChange(
  callback: (event: string, session: { user: { id: string } | null } | null) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
