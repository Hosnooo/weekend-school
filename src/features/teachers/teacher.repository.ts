import 'server-only';

import type {TeacherListItem} from '@/features/teachers/teacher.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type TeacherRow = {
  id: string;
  auth_user_id: string;
  display_name: string;
  preferred_language: 'en' | 'ar';
  is_active: boolean;
  group_teachers: Array<{
    groups: {id: string; name_en: string; name_ar: string | null} | null;
  }>;
};

const teacherSelect = `
  id,
  auth_user_id,
  display_name,
  preferred_language,
  is_active,
  group_teachers(groups(id, name_en, name_ar))
`;

function mapTeacher(row: TeacherRow): TeacherListItem {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    displayName: row.display_name,
    preferredLanguage: row.preferred_language,
    isActive: row.is_active,
    assignedGroups: row.group_teachers.flatMap(({groups}) =>
      groups ? [{id: groups.id, nameEn: groups.name_en, nameAr: groups.name_ar}] : []
    )
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
  input: {
    id: string;
    displayName: string;
    preferredLanguage: 'en' | 'ar';
    assignedGroupIds: string[];
    allowReassignment: boolean;
  }
) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('update_teacher_administration_confirmed', {
    p_teacher_profile_id: input.id,
    p_display_name: input.displayName,
    p_preferred_language: input.preferredLanguage,
    p_group_ids: input.assignedGroupIds,
    p_allow_reassignment: input.allowReassignment
  });
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
