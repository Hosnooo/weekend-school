'use server';

import {redirect} from 'next/navigation';

import {loginSchema} from '@/features/auth/auth.schemas';
import type {LoginState} from '@/features/auth/auth.types';
import {isLocale} from '@/i18n/config';
import {getDefaultAuthenticatedRoute} from '@/lib/auth/navigation';
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

  if (!parsed.success) return {error: 'invalidCredentials'};

  const db = await createServerSupabaseClient();
  const {data: authData, error: authError} = await db.auth.signInWithPassword(parsed.data);

  if (authError || !authData.user) return {error: 'invalidCredentials'};

  const {data: profile, error: profileError} = await db
    .from('profiles')
    .select('is_active')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (profileError || !profile?.is_active) {
    await db.auth.signOut();
    return {error: 'accessUnavailable'};
  }

  const [administratorResult, teacherResult] = await Promise.all([
    db.rpc('is_admin'),
    db.rpc('current_teacher_ids')
  ]);

  const teacherIds = Array.isArray(teacherResult.data)
    ? teacherResult.data.filter((value): value is string => typeof value === 'string')
    : [];
  const destination = getDefaultAuthenticatedRoute({
    isAdmin: administratorResult.data === true,
    teacherIds
  });

  if (administratorResult.error || teacherResult.error || !destination) {
    await db.auth.signOut();
    return {error: 'accessUnavailable'};
  }

  redirect(`/${locale}${destination}`);
}

export async function logoutAction(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? 'en');
  const locale = isLocale(localeValue) ? localeValue : 'en';
  const db = await createServerSupabaseClient();
  await db.auth.signOut();
  redirect(`/${locale}/login`);
}
