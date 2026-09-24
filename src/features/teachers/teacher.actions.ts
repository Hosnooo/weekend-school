'use server';

import {revalidatePath} from 'next/cache';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {buildPasswordRecoveryRedirect} from '@/features/auth/password-recovery.service';
import {
  assignTeacher,
  endTeacherAssignment
} from '@/features/teaching-assignments/teaching-assignment.repository';
import {
  endTeachingAssignmentSchema,
  teachingAssignmentSchema
} from '@/features/teaching-assignments/teaching-assignment.schemas';
import {setTeacherActive, updateTeacher} from '@/features/teachers/teacher.repository';
import {teacherSchema, teacherUpdateSchema} from '@/features/teachers/teacher.schemas';
import {
  inviteTeacher,
  resendTeacherAccess,
  type TeacherInvitationDependencies
} from '@/features/teachers/teacher.service';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {createServiceRoleSupabaseClient} from '@/lib/supabase/service-role';
import type {ActionState} from '@/lib/validation/action-state';
import {initialActionState, saveFailure, validationFailure} from '@/lib/validation/action-state';
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

function createInvitationDependencies(redirectTo: string): TeacherInvitationDependencies {
  const supabase = createServiceRoleSupabaseClient();
  return {
    async inviteAuthUser(input) {
      const {data, error} = await supabase.auth.admin.inviteUserByEmail(input.email, {
        data: {display_name: input.displayName, preferred_language: input.preferredLanguage},
        redirectTo
      });
      if (error || !data.user) throw error ?? new Error('Invitation returned no user');
      return data.user.id;
    },
    async createProfile(input, authUserId) {
      const {data, error} = await supabase
        .from('profiles')
        .insert({
          school_id: input.schoolId,
          auth_user_id: authUserId,
          display_name: input.displayName,
          role: 'TEACHER',
          preferred_language: input.preferredLanguage
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    async deleteProfile(profileId) {
      const {error} = await supabase.from('profiles').delete().eq('id', profileId);
      if (error) throw error;
    },
    async deleteAuthUser(authUserId) {
      const {error} = await supabase.auth.admin.deleteUser(authUserId);
      if (error) throw error;
    },
    async findUnclaimedAuthUser(email, schoolId) {
      for (let page = 1; page <= 100; page++) {
        const {data, error} = await supabase.auth.admin.listUsers({page, perPage: 1000});
        if (error) throw error;
        const match = data.users.find((user) => user.email?.toLowerCase() === email);
        if (match) {
          const {data: profile, error: profileError} = await supabase.from('profiles')
            .select('id, school_id, role').eq('auth_user_id', match.id).maybeSingle();
          if (profileError) throw profileError;
          if (profile?.school_id === schoolId && profile.role === 'ADMIN') {
            throw new Error('administrator already has an account');
          }
          if (profile?.school_id === schoolId && profile.role === 'TEACHER') {
            throw new Error('teacher already has an account');
          }
          return profile ? null : match.id;
        }
        if (data.users.length < 1000) return null;
      }
      throw new Error('Auth user lookup exceeded its page limit');
    },
    async sendExistingAccessLink(email) {
      const {error} = await supabase.auth.resetPasswordForEmail(email, {redirectTo});
      if (error) throw error;
    }
  };
}

export async function createTeacherAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = teacherSchema.safeParse(teacherInput(formData));
  if (!parsed.success) return validationFailure();
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
    if (!host) throw new Error('Invitation host is unavailable');
    const protocol = requestHeaders.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    const redirectTo = new URL(`/${parsed.data.preferredLanguage}/set-password`, `${protocol}://${host}`).toString();
    await inviteTeacher(
      {...parsed.data, schoolId: profile.schoolId},
      createInvitationDependencies(redirectTo)
    );
  } catch (error) {
    console.error('Unable to invite teacher', {error});
    if (error instanceof Error && error.message === 'administrator already has an account') return saveFailure('adminAccount');
    if (error instanceof Error && error.message === 'teacher already has an account') return saveFailure('teacherAccount');
    return saveFailure('invite');
  }
  revalidatePath(`/${locale}/teachers`);
  redirect(`/${locale}/teachers`);
}

export async function updateTeacherAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = teacherUpdateSchema.safeParse({
    id: formData.get('id'),
    displayName: formData.get('displayName'),
    preferredLanguage: formData.get('preferredLanguage')
  });
  if (!parsed.success) return validationFailure();
  try {
    await updateTeacher(profile.schoolId, parsed.data);
  } catch (error) {
    console.error('Unable to update teacher', {error});
    return saveFailure();
  }
  revalidatePath(`/${locale}/teachers`);
  redirect(`/${locale}/teachers`);
}

export async function assignTeacherAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = teachingAssignmentSchema.safeParse({
    teacherId: formData.get('teacherId'),
    classSubjectId: formData.get('classSubjectId'),
    subjectGroupId: formData.get('subjectGroupId'),
    startsOn: formData.get('startsOn')
  });
  if (!parsed.success) return validationFailure();
  try {
    await assignTeacher(profile.schoolId, parsed.data);
  } catch (error) {
    console.error('Unable to add teaching assignment', {error});
    return saveFailure();
  }
  revalidatePath(`/${locale}/teachers`);
  revalidatePath(`/${locale}/teachers/${parsed.data.teacherId}/edit`);
  return initialActionState;
}

export async function endTeacherAssignmentAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
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
  revalidatePath(`/${locale}/teachers`);
  revalidatePath(`/${locale}/teachers/${teacherId.data}/edit`);
}

export async function setTeacherActiveAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = z.object({id: databaseUuid, isActive: z.enum(['true', 'false'])}).safeParse({
    id: formData.get('id'),
    isActive: formData.get('isActive')
  });
  if (!parsed.success) return;
  await setTeacherActive(profile.schoolId, parsed.data.id, parsed.data.isActive === 'true');
  revalidatePath(`/${locale}/teachers`);
}

export async function resendTeacherAccessAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = databaseUuid.safeParse(formData.get('id'));
  if (!parsed.success) return;
  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  if (!origin || !host) throw new Error('Invitation origin is unavailable');
  const supabase = createServiceRoleSupabaseClient();
  let outcome: 'sent' | 'failed' = 'sent';
  try {
    await resendTeacherAccess(parsed.data, profile.schoolId, {
      async findTeacher(profileId, schoolId) {
        const {data, error} = await supabase.from('profiles')
          .select('auth_user_id, preferred_language')
          .eq('id', profileId).eq('school_id', schoolId).eq('role', 'TEACHER').eq('is_active', true).maybeSingle();
        if (error) throw error;
        return data ? {authUserId: data.auth_user_id as string, preferredLanguage: data.preferred_language as 'en' | 'ar'} : null;
      },
      async getAuthEmail(authUserId) {
        const {data, error} = await supabase.auth.admin.getUserById(authUserId);
        if (error) throw error;
        return data.user?.email ?? null;
      },
      async sendAccessLink(email, language) {
        const redirectTo = buildPasswordRecoveryRedirect(origin, host, language);
        const {error} = await supabase.auth.resetPasswordForEmail(email, {redirectTo});
        if (error) throw error;
      }
    });
  } catch (error) {
    console.error('Unable to resend teacher access', {error});
    outcome = 'failed';
  }
  revalidatePath(`/${locale}/teachers`);
  redirect(`/${locale}/teachers?access=${outcome}`);
}
