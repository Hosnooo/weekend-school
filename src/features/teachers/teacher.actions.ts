'use server';

import {revalidatePath} from 'next/cache';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {
  setTeacherActive,
  updateTeacher
} from '@/features/teachers/teacher.repository';
import {teacherSchema, teacherUpdateSchema} from '@/features/teachers/teacher.schemas';
import {
  inviteTeacher,
  type TeacherInvitationDependencies
} from '@/features/teachers/teacher.service';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {createServiceRoleSupabaseClient} from '@/lib/supabase/service-role';
import type {ActionState} from '@/lib/validation/action-state';
import {saveFailure, validationFailure} from '@/lib/validation/action-state';
import {databaseUuid} from '@/lib/validation/fields';

function localeFrom(formData: FormData) {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

function teacherInput(formData: FormData) {
  return {
    displayName: formData.get('displayName'),
    email: formData.get('email'),
    preferredLanguage: formData.get('preferredLanguage'),
    assignedGroupIds: formData.getAll('assignedGroupIds')
  };
}

function createInvitationDependencies(redirectTo: string): TeacherInvitationDependencies {
  const supabase = createServiceRoleSupabaseClient();
  return {
    async validateAssignments(input) {
      if (input.assignedGroupIds.length === 0) return;
      const {data: groups, error} = await supabase
        .from('groups')
        .select('id, group_teachers!inner(assignment_type)')
        .eq('school_id', input.schoolId)
        .eq('is_active', true)
        .in('id', input.assignedGroupIds)
        .eq('group_teachers.assignment_type', 'PRIMARY');
      if (error) throw error;
      if (groups.length > 0) throw new Error('A selected group already has a primary teacher');

      const {data: validGroups, error: validError} = await supabase
        .from('groups')
        .select('id')
        .eq('school_id', input.schoolId)
        .eq('is_active', true)
        .in('id', input.assignedGroupIds);
      if (validError) throw validError;
      if (validGroups.length !== input.assignedGroupIds.length) {
        throw new Error('Invalid group assignment');
      }
    },
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
    async assignGroups(schoolId, profileId, groupIds) {
      if (groupIds.length === 0) return;
      const {data: groups, error: groupError} = await supabase
        .from('groups')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .in('id', groupIds);
      if (groupError) throw groupError;
      if (groups.length !== groupIds.length) throw new Error('Invalid group assignment');
      const {error} = await supabase.from('group_teachers').insert(
        groupIds.map((groupId) => ({
          school_id: schoolId,
          group_id: groupId,
          teacher_profile_id: profileId,
          assignment_type: 'PRIMARY'
        }))
      );
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
  await requireProfile(locale, 'ADMIN');
  const parsed = teacherUpdateSchema.safeParse({
    id: formData.get('id'),
    displayName: formData.get('displayName'),
    preferredLanguage: formData.get('preferredLanguage'),
    assignedGroupIds: formData.getAll('assignedGroupIds'),
    allowReassignment: formData.get('allowReassignment') === 'true'
  });
  if (!parsed.success) return validationFailure();
  try {
    await updateTeacher(parsed.data);
  } catch (error) {
    console.error('Unable to update teacher', {error});
    if (typeof error === 'object' && error !== null && 'message' in error && error.message === 'primary teacher conflict') {
      return saveFailure('conflict');
    }
    return saveFailure();
  }
  revalidatePath(`/${locale}/teachers`);
  redirect(`/${locale}/teachers`);
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
