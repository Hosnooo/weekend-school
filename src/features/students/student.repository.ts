import 'server-only';

import type {StudentUpdateInput} from '@/features/students/student.schemas';
import type {StudentListItem} from '@/features/students/student.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type StudentRow = {
  id: string;
  first_name_en: string;
  last_name_en: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
  is_active: boolean;
  group_memberships: Array<{
    ends_on: string | null;
    groups: {id: string; name_en: string; name_ar: string | null} | null;
  }>;
};

function mapStudent(row: StudentRow): StudentListItem {
  const membership = row.group_memberships.find(({ends_on}) => ends_on === null);
  return {
    id: row.id,
    firstNameEn: row.first_name_en,
    lastNameEn: row.last_name_en,
    firstNameAr: row.first_name_ar,
    lastNameAr: row.last_name_ar,
    isActive: row.is_active,
    currentGroup: membership?.groups
      ? {
          id: membership.groups.id,
          nameEn: membership.groups.name_en,
          nameAr: membership.groups.name_ar
        }
      : null
  };
}

const studentSelect = `
  id,
  first_name_en,
  last_name_en,
  first_name_ar,
  last_name_ar,
  is_active,
  group_memberships(ends_on, groups(id, name_en, name_ar))
`;

export async function listStudents(schoolId: string) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('students')
    .select(studentSelect)
    .eq('school_id', schoolId)
    .order('last_name_en')
    .order('first_name_en');
  if (error) throw error;
  return (data as unknown as StudentRow[]).map(mapStudent);
}

export async function getStudent(schoolId: string, id: string) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('students')
    .select(studentSelect)
    .eq('school_id', schoolId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapStudent(data as unknown as StudentRow) : null;
}

export async function createStudentWithGuardian(
  schoolId: string,
  input: {
    firstNameEn: string;
    lastNameEn: string;
    firstNameAr: string | null;
    lastNameAr: string | null;
    groupId: string;
    guardianName: string;
    guardianEmail: string;
    reportLanguage: 'en' | 'ar' | 'both';
    startsOn: string;
  }
) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase.rpc('create_student_with_guardian', {
    p_first_name_en: input.firstNameEn,
    p_last_name_en: input.lastNameEn,
    p_first_name_ar: input.firstNameAr ?? '',
    p_last_name_ar: input.lastNameAr ?? '',
    p_group_id: input.groupId,
    p_guardian_name: input.guardianName,
    p_guardian_email: input.guardianEmail,
    p_report_language: input.reportLanguage,
    p_starts_on: input.startsOn
  });
  if (error) throw error;
  if (!data) throw new Error(`Student creation returned no id for school ${schoolId}`);
  return data as string;
}

export async function updateStudent(schoolId: string, input: StudentUpdateInput) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase
    .from('students')
    .update({
      first_name_en: input.firstNameEn,
      last_name_en: input.lastNameEn,
      first_name_ar: input.firstNameAr,
      last_name_ar: input.lastNameAr
    })
    .eq('school_id', schoolId)
    .eq('id', input.id);
  if (error) throw error;
}

export async function setStudentActive(schoolId: string, id: string, isActive: boolean) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase
    .from('students')
    .update({is_active: isActive})
    .eq('school_id', schoolId)
    .eq('id', id);
  if (error) throw error;
}
