'use server';

import {redirect} from 'next/navigation';

import {loginSchema} from '@/features/auth/auth.schemas';
import type {LoginState} from '@/features/auth/auth.types';
import {isLocale} from '@/i18n/config';
import {createServerSupabaseClient} from '@/lib/supabase/server';

export async function loginAction(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const localeValue = String(formData.get('locale') ?? 'en');
  const locale = isLocale(localeValue) ? localeValue : 'en';
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password')
  });

  if (!parsed.success) {
    return {error: 'invalidCredentials'};
  }

  const supabase = await createServerSupabaseClient();
  const {data: authData, error: authError} = await supabase.auth.signInWithPassword(
    parsed.data
  );

  if (authError || !authData.user) {
    return {error: 'invalidCredentials'};
  }

  const {data: profile, error: profileError} = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (profileError || !profile?.is_active) {
    await supabase.auth.signOut();
    return {error: 'accessUnavailable'};
  }

  redirect(
    profile.role === 'ADMIN' ? `/${locale}/dashboard` : `/${locale}/my-groups`
  );
}

export async function logoutAction(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? 'en');
  const locale = isLocale(localeValue) ? localeValue : 'en';
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/login`);
}
