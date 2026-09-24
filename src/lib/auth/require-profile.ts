import 'server-only';

import {redirect} from 'next/navigation';

import type {Profile} from '@/features/profiles/profile.types';
import type {Locale} from '@/i18n/config';
import {
  assertActiveProfile,
  canAdmin,
  canTeach,
  type AccountCapabilities
} from '@/lib/auth/authorization';
import type {AppRole} from '@/lib/auth/navigation';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type ProfileRow = {
  id: string;
  school_id: string;
  display_name: string;
  preferred_language: Locale;
  is_active: boolean;
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    schoolId: row.school_id,
    displayName: row.display_name,
    preferredLanguage: row.preferred_language,
    isActive: row.is_active
  };
}

async function requireAccountContext(
  locale: Locale
): Promise<{profile: Profile; capabilities: AccountCapabilities}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const {data, error} = await supabase
    .from('profiles')
    .select('id, school_id, display_name, preferred_language, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Unable to load authenticated profile', {code: error.code});
  }

  let profile: Profile;
  try {
    profile = assertActiveProfile(data ? toProfile(data as ProfileRow) : null);
  } catch {
    redirect(`/${locale}/login?reason=access`);
  }

  const [administratorResult, teacherResult] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.rpc('current_teacher_ids')
  ]);

  if (administratorResult.error) {
    console.error('Unable to load administrator capability', {
      code: administratorResult.error.code
    });
  }
  if (teacherResult.error) {
    console.error('Unable to load teacher capabilities', {code: teacherResult.error.code});
  }

  if (administratorResult.error || teacherResult.error) {
    redirect(`/${locale}/login?reason=access`);
  }

  const teacherIds = Array.isArray(teacherResult.data)
    ? teacherResult.data.filter((value): value is string => typeof value === 'string')
    : [];

  return {
    profile,
    capabilities: {
      isAdmin: administratorResult.data === true,
      teacherIds
    }
  };
}

export async function requireProfile(locale: Locale, legacyRole?: AppRole): Promise<Profile> {
  const {profile, capabilities} = await requireAccountContext(locale);

  // Transitional call-shape compatibility only: these checks now resolve
  // requested capabilities exclusively from explicit account links.
  if (legacyRole === 'ADMIN' && !canAdmin(capabilities)) {
    redirect(`/${locale}/login?reason=access`);
  }
  if (legacyRole === 'TEACHER' && !canTeach(capabilities)) {
    redirect(`/${locale}/login?reason=access`);
  }

  return profile;
}

export async function requireProfileWithCapabilities(
  locale: Locale
): Promise<{profile: Profile; capabilities: AccountCapabilities}> {
  return requireAccountContext(locale);
}

export async function requireAdministrator(locale: Locale): Promise<Profile> {
  const {profile, capabilities} = await requireAccountContext(locale);
  if (!canAdmin(capabilities)) {
    redirect(`/${locale}/login?reason=access`);
  }
  return profile;
}

export async function requireTeachingAccount(
  locale: Locale
): Promise<{profile: Profile; teacherIds: string[]}> {
  const {profile, capabilities} = await requireAccountContext(locale);
  if (!canTeach(capabilities)) {
    redirect(`/${locale}/login?reason=access`);
  }
  return {profile, teacherIds: capabilities.teacherIds};
}

export async function requireTeachingProfile(locale: Locale): Promise<Profile> {
  return (await requireTeachingAccount(locale)).profile;
}
