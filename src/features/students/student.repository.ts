import 'server-only';

import type {StudentUpdateInput} from '@/features/students/student.schemas';
import type {StudentListItem} from '@/features/students/student.types';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type StudentRow = {
  id: string;
  first_name_en: string;
  last_name_en: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
  is_active: boolean;
  class_enrollments: Array<{
    starts_on: string;
    ends_on: string | null;
    classes: {id: string; name_en: string; name_ar: string | null} | null;
  }>;
};

function mapStudent(row: StudentRow, today: string): StudentListItem {
  const effective = row.class_enrollments.filter((enrollment) =>
    enrollment.starts_on <= today &&
    (enrollment.ends_on === null || enrollment.ends_on >= today)
  );
  if (effective.length > 1) {
    throw new Error('A student has overlapping Class enrollments');
  }
  const currentClass = effective[0]?.classes
    ? {
        id: effective[0].classes.id,
        nameEn: effective[0].classes.name_en,
        nameAr: effective[0].classes.name_ar
      }
    : null;

  return {
    id: row.id,
    firstNameEn: row.first_name_en,
    lastNameEn: row.last_name_en,
    firstNameAr: row.first_name_ar,
    lastNameAr: row.last_name_ar,
    isActive: row.is_active,
    currentClass
  };
}

const studentSelect = `
  id,
  first_name_en,
  last_name_en,
  first_name_ar,
  last_name_ar,
  is_active,
  class_enrollments(starts_on, ends_on, classes(id, name_en, name_ar))
`;

export async function listStudents(schoolId: string) {
  const supabase = await createServerSupabaseClient();
  const [{data, error}, {data: school, error: schoolError}] = await Promise.all([
    supabase
      .from('students')
      .select(studentSelect)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('last_name_en')
      .order('first_name_en'),
    supabase.from('schools').select('timezone').eq('id', schoolId).single()
  ]);
  if (error) throw error;
  if (schoolError) throw schoolError;
  const today = todayInTimeZone(school.timezone);
  return (data as unknown as StudentRow[]).map((row) => mapStudent(row, today));
}

export async function getStudent(schoolId: string, id: string) {
  const supabase = await createServerSupabaseClient();
  const [{data, error}, {data: school, error: schoolError}] = await Promise.all([
    supabase
      .from('students')
      .select(studentSelect)
      .eq('school_id', schoolId)
      .eq('id', id)
      .maybeSingle(),
    supabase.from('schools').select('timezone').eq('id', schoolId).single()
  ]);
  if (error) throw error;
  if (schoolError) throw schoolError;
  return data ? mapStudent(data as unknown as StudentRow, todayInTimeZone(school.timezone)) : null;
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
