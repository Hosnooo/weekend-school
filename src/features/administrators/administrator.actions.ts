'use server';

import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {
  countActiveAdministratorsWithServiceRole,
  deleteAdministratorRecordWithServiceRole,
  insertAdministrator,
  loadAdministratorWithServiceRole,
  setAdministratorActiveWithServiceRole,
  unlinkAdministratorAccountsWithServiceRole
} from '@/features/administrators/administrator.repository';
import {
  createAdministratorBusinessRecord,
  deleteAdministratorSafely,
  ensureAdministratorAccess,
  setAdministratorActiveSafely,
  type AdministratorAccessDependencies,
  type AdministratorLifecycleDependencies
} from '@/features/administrators/administrator.service';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';
import {createServiceRoleSupabaseClient} from '@/lib/supabase/service-role';
import {databaseUuid} from '@/lib/validation/fields';

const administratorInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email()
});

function localeFrom(formData: FormData) {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

function accessRedirectTo(host: string, protocol: string, locale: 'en' | 'ar') {
  return new URL(`/${locale}/set-password`, `${protocol}://${host}`).toString();
}

async function invitationRedirect(locale: 'en' | 'ar') {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  if (!host) throw new Error('Invitation host is unavailable');
  const protocol = requestHeaders.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return accessRedirectTo(host, protocol, locale);
}

function createAccessDependencies(): AdministratorAccessDependencies {
  const supabase = createServiceRoleSupabaseClient();
  return {
    async loadAdministrator(administratorId, schoolId) {
      const administrator = await loadAdministratorWithServiceRole(administratorId, schoolId);
      return administrator ? {
        id: administrator.id,
        schoolId: administrator.schoolId,
        displayName: administrator.displayName
      } : null;
    },
    async findAuthUserByEmail(email) {
      for (let page = 1; page <= 100; page++) {
        const {data, error} = await supabase.auth.admin.listUsers({page, perPage: 1000});
        if (error) throw error;
        const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
        if (match) return {id: match.id};
        if (data.users.length < 1000) return null;
      }
      throw new Error('Auth user lookup exceeded its page limit');
    },
    async findProfileByAuthUserId(authUserId) {
      const {data, error} = await supabase.from('profiles')
        .select('id,school_id,is_active')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      if (error) throw error;
      return data ? {
        id: data.id as string,
        schoolId: data.school_id as string,
        isActive: data.is_active as boolean
      } : null;
    },
    async inviteAuthUser(input) {
      const {data, error} = await supabase.auth.admin.inviteUserByEmail(input.email, {
        data: {
          display_name: input.displayName,
          preferred_language: input.preferredLanguage
        },
        redirectTo: input.redirectTo
      });
      if (error || !data.user) throw error ?? new Error('Invitation returned no user');
      return data.user.id;
    },
    async createProfile(input) {
      const {data, error} = await supabase.from('profiles').insert({
        school_id: input.schoolId,
        auth_user_id: input.authUserId,
        display_name: input.displayName,
        preferred_language: input.preferredLanguage
      }).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    async linkAdministratorAccount(input) {
      const {error} = await supabase.from('administrator_accounts').upsert({
        school_id: input.schoolId,
        administrator_id: input.administratorId,
        profile_id: input.profileId
      }, {
        onConflict: 'school_id,administrator_id,profile_id',
        ignoreDuplicates: true
      });
      if (error) throw error;
    },
    async sendAccessLink(email, redirectTo) {
      const {error} = await supabase.auth.resetPasswordForEmail(email, {redirectTo});
      if (error) throw error;
    },
    async deleteProfile(profileId) {
      const {error} = await supabase.from('profiles').delete().eq('id', profileId);
      if (error) throw error;
    },
    async deleteAuthUser(authUserId) {
      const {error} = await supabase.auth.admin.deleteUser(authUserId);
      if (error) throw error;
    }
  };
}

function lifecycleDependencies(): AdministratorLifecycleDependencies {
  return {
    async loadAdministrator(administratorId, schoolId) {
      const administrator = await loadAdministratorWithServiceRole(administratorId, schoolId);
      return administrator ? {
        id: administrator.id,
        schoolId: administrator.schoolId,
        isActive: administrator.isActive
      } : null;
    },
    countActiveAdministrators: countActiveAdministratorsWithServiceRole,
    setAdministratorActive: setAdministratorActiveWithServiceRole,
    unlinkAdministratorAccounts: unlinkAdministratorAccountsWithServiceRole,
    deleteAdministratorRecord: deleteAdministratorRecordWithServiceRole
  };
}

function isLastAdministratorError(error: unknown) {
  return error instanceof Error && error.message.includes('last active Administrator');
}

export async function createAdministratorAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const parsed = administratorInputSchema.safeParse({
    displayName: formData.get('displayName'),
    email: formData.get('email')
  });
  if (!parsed.success) redirect(`/${locale}/administrators/new?error=validation`);

  let administratorId: string;
  try {
    administratorId = await createAdministratorBusinessRecord({
      schoolId: profile.schoolId,
      ...parsed.data
    }, {createAdministrator: insertAdministrator});
  } catch (error) {
    console.error('Unable to create administrator', {error});
    redirect(`/${locale}/administrators/new?error=save`);
  }

  try {
    await ensureAdministratorAccess({
      schoolId: profile.schoolId,
      administratorId,
      loginEmail: parsed.data.email,
      redirectTo: await invitationRedirect(locale),
      preferredLanguage: locale
    }, createAccessDependencies());
  } catch (error) {
    console.error('Unable to create administrator access', {error});
    try {
      await setAdministratorActiveWithServiceRole(profile.schoolId, administratorId, false);
    } catch (deactivationError) {
      console.error('Unable to deactivate administrator after access failure', {error: deactivationError});
    }
    revalidatePath(`/${locale}/administrators`);
    redirect(`/${locale}/administrators?access=failed`);
  }

  revalidatePath(`/${locale}/administrators`);
  redirect(`/${locale}/administrators?created=1`);
}

export async function resendAdministratorAccessAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const administratorId = databaseUuid.safeParse(formData.get('administratorId'));
  if (!administratorId.success) redirect(`/${locale}/administrators?error=validation`);

  const accessPath = `/${locale}/administrators/${administratorId.data}/access`;
  try {
    const administrator = await loadAdministratorWithServiceRole(administratorId.data, profile.schoolId);
    if (!administrator?.email) throw new Error('Administrator login email is unavailable');
    await ensureAdministratorAccess({
      schoolId: profile.schoolId,
      administratorId: administrator.id,
      loginEmail: administrator.email,
      redirectTo: await invitationRedirect(locale),
      preferredLanguage: locale,
      resendExistingAccess: true
    }, createAccessDependencies());
    if (!administrator.isActive) {
      await setAdministratorActiveSafely({
        schoolId: profile.schoolId,
        administratorId: administrator.id,
        isActive: true
      }, lifecycleDependencies());
    }
  } catch (error) {
    console.error('Unable to send administrator access', {error});
    redirect(`${accessPath}?access=failed`);
  }

  revalidatePath(`/${locale}/administrators`);
  revalidatePath(`/${locale}/administrators/${administratorId.data}`);
  revalidatePath(accessPath);
  redirect(`${accessPath}?access=sent`);
}

export async function setAdministratorActiveAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const parsed = z.object({
    administratorId: databaseUuid,
    isActive: z.enum(['true', 'false'])
  }).safeParse({
    administratorId: formData.get('administratorId'),
    isActive: formData.get('isActive')
  });
  if (!parsed.success) redirect(`/${locale}/administrators?error=validation`);

  try {
    await setAdministratorActiveSafely({
      schoolId: profile.schoolId,
      administratorId: parsed.data.administratorId,
      isActive: parsed.data.isActive === 'true'
    }, lifecycleDependencies());
  } catch (error) {
    console.error('Unable to change administrator status', {error});
    const reason = isLastAdministratorError(error) ? 'last-admin' : 'save';
    redirect(`/${locale}/administrators?error=${reason}`);
  }

  revalidatePath(`/${locale}/administrators`);
  revalidatePath(`/${locale}/administrators/${parsed.data.administratorId}`);
  redirect(`/${locale}/administrators`);
}

export async function deleteAdministratorAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const administratorId = databaseUuid.safeParse(formData.get('administratorId'));
  if (!administratorId.success) redirect(`/${locale}/administrators?error=validation`);

  try {
    await deleteAdministratorSafely({
      schoolId: profile.schoolId,
      administratorId: administratorId.data
    }, lifecycleDependencies());
  } catch (error) {
    console.error('Unable to delete administrator', {error});
    const reason = isLastAdministratorError(error) ? 'last-admin' : 'save';
    redirect(`/${locale}/administrators?error=${reason}`);
  }

  revalidatePath(`/${locale}/administrators`);
  redirect(`/${locale}/administrators?deleted=1`);
}
