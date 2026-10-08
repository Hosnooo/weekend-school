'use server';

import {revalidatePath} from 'next/cache';
import {accountAccessError} from '@/features/auth/account-access-error';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {
  assignTeacher,
  endTeacherAssignment
} from '@/features/teaching-assignments/teaching-assignment.repository';
import {
  endTeachingAssignmentSchema,
  teachingAssignmentSchema
} from '@/features/teaching-assignments/teaching-assignment.schemas';
import {
  getTeacher,
  insertTeacher,
  setTeacherActive,
  updateTeacher
} from '@/features/teachers/teacher.repository';
import {teacherSchema, teacherUpdateSchema} from '@/features/teachers/teacher.schemas';
import {
  createTeacherBusinessRecord,
  ensureTeacherAccess,
  unlinkTeacherAccess,
  type TeacherAccessDependencies,
  type UnlinkTeacherAccessDependencies
} from '@/features/teachers/teacher.service';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';
import {createServiceRoleSupabaseClient} from '@/lib/supabase/service-role';
import type {ActionState} from '@/lib/validation/action-state';
import {initialActionState, persistenceFailure, saveFailure, validationFailure} from '@/lib/validation/action-state';
import {databaseUuid} from '@/lib/validation/fields';

function localeFrom(formData: FormData) {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

function teacherInput(formData: FormData) {
  return {
    displayName: formData.get('displayName'),
    email: formData.get('email'),
    preferredLanguage: formData.get('preferredLanguage')
  };
}

function accessRedirectTo(
  host: string,
  protocol: string,
  preferredLanguage: 'en' | 'ar'
) {
  return new URL(`/${preferredLanguage}/set-password`, `${protocol}://${host}`).toString();
}

function createAccessDependencies(): TeacherAccessDependencies {
  const supabase = createServiceRoleSupabaseClient();
  return {
    async loadTeacher(teacherId, schoolId) {
      const {data, error} = await supabase.from('teachers')
        .select('id,school_id,display_name,preferred_language')
        .eq('id', teacherId)
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data ? {
        id: data.id as string,
        schoolId: data.school_id as string,
        displayName: data.display_name as string,
        preferredLanguage: data.preferred_language as 'en' | 'ar'
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
        .select('id,school_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      if (error) throw error;
      return data ? {id: data.id as string, schoolId: data.school_id as string} : null;
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
    async linkTeacherAccount(input) {
      const {error} = await supabase.from('teacher_accounts').upsert({
        school_id: input.schoolId,
        teacher_id: input.teacherId,
        profile_id: input.profileId
      }, {
        onConflict: 'school_id,teacher_id,profile_id',
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

function createUnlinkDependencies(): UnlinkTeacherAccessDependencies {
  const supabase = createServiceRoleSupabaseClient();
  return {
    async unlinkTeacherAccount(input) {
      const {error} = await supabase.from('teacher_accounts').delete()
        .eq('school_id', input.schoolId)
        .eq('teacher_id', input.teacherId)
        .eq('profile_id', input.profileId);
      if (error) throw error;
    }
  };
}

function revalidateTeacherSurfaces(locale: string, teacherId: string) {
  revalidatePath(`/${locale}/teachers`);
  revalidatePath(`/${locale}/teachers/${teacherId}`);
  revalidatePath(`/${locale}/teachers/${teacherId}/edit`);
  revalidatePath(`/${locale}/teachers/${teacherId}/access`);
  revalidatePath(`/${locale}/teachers/${teacherId}/assignments`);
}

export async function createTeacherAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const parsed = teacherSchema.safeParse(teacherInput(formData));
  if (!parsed.success) return validationFailure(parsed.success ? undefined : parsed.error);
  try {
    await createTeacherBusinessRecord(
      {...parsed.data, schoolId: profile.schoolId},
      {createTeacher: insertTeacher}
    );
  } catch (error) {
    console.error('Unable to create teacher', {error});
    return persistenceFailure(error);
  }
  revalidatePath(`/${locale}/teachers`);
  redirect(`/${locale}/teachers`);
}

export async function updateTeacherAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const parsed = teacherUpdateSchema.safeParse({
    id: formData.get('id'),
    displayName: formData.get('displayName'),
    email: formData.get('email'),
    preferredLanguage: formData.get('preferredLanguage')
  });
  if (!parsed.success) return validationFailure(parsed.success ? undefined : parsed.error);
  try {
    await updateTeacher(profile.schoolId, parsed.data);
  } catch (error) {
    console.error('Unable to update teacher', {error});
    return persistenceFailure(error);
  }
  revalidateTeacherSurfaces(locale, parsed.data.id);
  redirect(`/${locale}/teachers/${parsed.data.id}`);
}

export async function assignTeacherAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const parsed = teachingAssignmentSchema.safeParse({
    teacherId: formData.get('teacherId'),
    classSubjectId: formData.get('classSubjectId'),
    startsOn: formData.get('startsOn')
  });
  if (!parsed.success) return validationFailure(parsed.success ? undefined : parsed.error);
  try {
    await assignTeacher(profile.schoolId, parsed.data);
  } catch (error) {
    console.error('Unable to add teaching assignment', {error});
    return persistenceFailure(error);
  }
  revalidateTeacherSurfaces(locale, parsed.data.teacherId);
  return initialActionState;
}

export async function endTeacherAssignmentAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const teacherId = databaseUuid.safeParse(formData.get('teacherId'));
  const parsed = endTeachingAssignmentSchema.safeParse({
    assignmentId: formData.get('assignmentId'),
    endsOn: formData.get('endsOn')
  });
  if (!teacherId.success || !parsed.success) return;
  try {
    await endTeacherAssignment(profile.schoolId, teacherId.data, parsed.data);
  } catch (error) {
    console.error('Unable to end teaching assignment', {error});
    return;
  }
  revalidateTeacherSurfaces(locale, teacherId.data);
}

export async function setTeacherActiveAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const parsed = z.object({id: databaseUuid, isActive: z.enum(['true', 'false'])}).safeParse({
    id: formData.get('id'),
    isActive: formData.get('isActive')
  });
  if (!parsed.success) return {ok: false as const, error: 'validation' as const};
  try {
    await setTeacherActive(profile.schoolId, parsed.data.id, parsed.data.isActive === 'true');
  } catch (error) {
    console.error('Unable to change Teacher status', {error});
    const classified = persistenceFailure(error);
    return {ok: false as const, error: classified.error ?? 'save'};
  }
  revalidateTeacherSurfaces(locale, parsed.data.id);
  return {ok: true as const};
}

export async function resendTeacherAccessAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const parsed = databaseUuid.safeParse(formData.get('id'));
  if (!parsed.success) return;

  let outcome: 'sent' | 'accountUnavailable' | 'emailMissing' | 'rateLimited' | 'stale' | 'failed' = 'sent';
  try {
    const teacher = await getTeacher(profile.schoolId, parsed.data);
    if (!teacher?.email) throw new Error('Teacher login email is unavailable');
    const requestHeaders = await headers();
    const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
    if (!host) throw new Error('Invitation host is unavailable');
    const protocol = requestHeaders.get('x-forwarded-proto') ??
      (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    const redirectTo = accessRedirectTo(host, protocol, teacher.preferredLanguage);
    await ensureTeacherAccess({
      schoolId: profile.schoolId,
      teacherId: teacher.id,
      loginEmail: teacher.email,
      redirectTo,
      resendExistingAccess: Boolean(teacher.accountProfileId)
    }, createAccessDependencies());
  } catch (error) {
    console.error('Unable to send teacher access', {error});
    outcome = accountAccessError(error);
  }

  revalidateTeacherSurfaces(locale, parsed.data);
  redirect(`/${locale}/teachers/${parsed.data}/access?access=${outcome}`);
}

export async function unlinkTeacherAccessAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const parsed = z.object({teacherId: databaseUuid, profileId: databaseUuid}).safeParse({
    teacherId: formData.get('teacherId'),
    profileId: formData.get('profileId')
  });
  if (!parsed.success) {
    const teacherId = databaseUuid.safeParse(formData.get('teacherId'));
    redirect(teacherId.success
      ? `/${locale}/teachers/${teacherId.data}/access?access=invalid`
      : `/${locale}/teachers`);
  }

  try {
    await unlinkTeacherAccess({
      schoolId: profile.schoolId,
      teacherId: parsed.data.teacherId,
      profileId: parsed.data.profileId
    }, createUnlinkDependencies());
  } catch (error) {
    console.error('Unable to unlink teacher access', {error});
    redirect(`/${locale}/teachers/${parsed.data.teacherId}/access?access=unlinkFailed`);
  }

  revalidateTeacherSurfaces(locale, parsed.data.teacherId);
  redirect(`/${locale}/teachers/${parsed.data.teacherId}/access?access=unlinked`);
}
