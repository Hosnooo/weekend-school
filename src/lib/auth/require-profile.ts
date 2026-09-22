import 'server-only';

import {redirect} from 'next/navigation';

import type {Profile} from '@/features/profiles/profile.types';
import type {Locale} from '@/i18n/config';
import {assertActiveProfile, assertRole, assertTeachingProfile} from '@/lib/auth/authorization';
import type {AppRole} from '@/lib/auth/navigation';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type ProfileRow = {
  id: string;
  school_id: string;
  display_name: string;
  role: AppRole;
  preferred_language: Locale;
  is_active: boolean;
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    schoolId: row.school_id,
    displayName: row.display_name,
    role: row.role,
    preferredLanguage: row.preferred_language,
    isActive: row.is_active
  };
}

export async function requireProfile(locale: Locale, requiredRole?: AppRole) {
  const supabase = await createServerSupabaseClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const {data, error} = await supabase
    .from('profiles')
    .select('id, school_id, display_name, role, preferred_language, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Unable to load authenticated profile', {code: error.code});
  }

  try {
    const profile = assertActiveProfile(data ? toProfile(data as ProfileRow) : null);
    return requiredRole ? assertRole(profile, requiredRole) : profile;
  } catch {
    redirect(`/${locale}/login?reason=access`);
  }
}

export async function requireTeachingProfile(locale: Locale) {
  return assertTeachingProfile(await requireProfile(locale));
}
