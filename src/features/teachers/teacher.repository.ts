import 'server-only';

import type {TeacherListItem} from '@/features/teachers/teacher.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {createServiceRoleSupabaseClient} from '@/lib/supabase/service-role';

type TeacherRow = {
  id: string;
  auth_user_id: string;
  display_name: string;
  preferred_language: 'en' | 'ar';
  is_active: boolean;
  teaching_assignments: Array<{
    starts_on: string;
    ends_on: string | null;
  }>;
};

const teacherSelect = `
  id,
  auth_user_id,
  display_name,
  preferred_language,
  is_active,
  teaching_assignments(starts_on, ends_on)
`;

function mapTeacher(row: TeacherRow): TeacherListItem {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    displayName: row.display_name,
    preferredLanguage: row.preferred_language,
    isActive: row.is_active,
    assignmentCount: row.teaching_assignments.filter(({starts_on, ends_on}) =>
      starts_on <= today && (ends_on === null || ends_on >= today)
    ).length
  };
}

export async function listTeachers(schoolId: string) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('profiles')
    .select(teacherSelect)
    .eq('school_id', schoolId)
    .eq('role', 'TEACHER')
    .order('display_name');
  if (error) throw error;
  return (data as unknown as TeacherRow[]).map(mapTeacher);
}

export async function getTeacherAccessStates(teachers: TeacherListItem[]): Promise<Record<string, 'signedIn' | 'linkSent' | 'unknown'>> {
  const supabase = createServiceRoleSupabaseClient();
  const entries = await Promise.all(teachers.map(async (teacher) => {
    const {data, error} = await supabase.auth.admin.getUserById(teacher.authUserId);
    if (error || !data.user) return [teacher.id, 'unknown'] as const;
    return [teacher.id, data.user.last_sign_in_at ? 'signedIn' : data.user.invited_at ? 'linkSent' : 'unknown'] as const;
  }));
  return Object.fromEntries(entries);
}

export async function listTeachingCandidates(schoolId: string) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('school_id', schoolId)
    .in('role', ['ADMIN', 'TEACHER'])
    .eq('is_active', true)
    .order('display_name');
  if (error) throw error;
  return data.map((row) => ({id: row.id as string, displayName: row.display_name as string}));
}

export async function getTeacher(schoolId: string, id: string) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('profiles')
    .select(teacherSelect)
    .eq('school_id', schoolId)
    .eq('id', id)
    .eq('role', 'TEACHER')
    .maybeSingle();
  if (error) throw error;
  return data ? mapTeacher(data as unknown as TeacherRow) : null;
}

export async function updateTeacher(
  schoolId: string,
  input: {
    id: string;
    displayName: string;
    preferredLanguage: 'en' | 'ar';
  }
) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase
    .from('profiles')
    .update({display_name: input.displayName, preferred_language: input.preferredLanguage})
    .eq('school_id', schoolId)
    .eq('id', input.id)
    .eq('role', 'TEACHER');
  if (error) throw error;
}

export async function setTeacherActive(schoolId: string, id: string, isActive: boolean) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase
    .from('profiles')
    .update({is_active: isActive})
    .eq('school_id', schoolId)
    .eq('id', id)
    .eq('role', 'TEACHER');
  if (error) throw error;
}
