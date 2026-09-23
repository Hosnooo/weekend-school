import 'server-only';

import type {
  ClassDetail,
  ClassSummary,
  SubjectOption
} from '@/features/classes/class.types';
import type {
  ClassInput,
  ClassSubjectInput,
  DefaultGroupInput,
  SubjectGroupInput,
  SubjectInput
} from '@/features/classes/class.schemas';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type ClassListRow = {
  id: string;
  name_en: string;
  name_ar: string | null;
  is_active: boolean;
  class_subjects: Array<{id: string; is_active: boolean}>;
  class_enrollments: Array<{
    starts_on: string;
    ends_on: string | null;
  }>;
};

type ClassSubjectRow = {
  id: string;
  subject_id: string;
  default_group_id: string | null;
  is_active: boolean;
  subjects: {name_en: string; name_ar: string | null} | null;
  subject_groups: Array<{
    id: string;
    name_en: string;
    name_ar: string | null;
    is_active: boolean;
  }>;
  teaching_assignments: Array<{
    teacher_profile_id: string;
    starts_on: string;
    ends_on: string | null;
  }>;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function includesDate(
  startsOn: string,
  endsOn: string | null,
  date: string
) {
  return startsOn <= date && (endsOn === null || endsOn >= date);
}

export async function listClasses(schoolId: string): Promise<ClassSummary[]> {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('classes')
    .select(`
      id,
      name_en,
      name_ar,
      is_active,
      class_subjects(id, is_active),
      class_enrollments(starts_on, ends_on)
    `)
    .eq('school_id', schoolId)
    .order('name_en');

  if (error) throw error;

  const today = todayIso();
  return (data as unknown as ClassListRow[]).map((row) => ({
    id: row.id,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    isActive: row.is_active,
    activeStudentCount: row.class_enrollments.filter(({starts_on, ends_on}) =>
      includesDate(starts_on, ends_on, today)
    ).length,
    subjectCount: row.class_subjects.filter(({is_active}) => is_active).length
  }));
}

export async function getClassDetail(
  schoolId: string,
  classId: string
): Promise<ClassDetail | null> {
  const supabase = await createServerSupabaseClient();
  const {data: classRow, error: classError} = await supabase
    .from('classes')
    .select('id, name_en, name_ar, is_active')
    .eq('school_id', schoolId)
    .eq('id', classId)
    .maybeSingle();

  if (classError) throw classError;
  if (!classRow) return null;

  const {data: subjectRows, error: subjectError} = await supabase
    .from('class_subjects')
    .select(`
      id,
      subject_id,
      default_group_id,
      is_active,
      subjects(name_en, name_ar),
      subject_groups(id, name_en, name_ar, is_active),
      teaching_assignments(teacher_profile_id, starts_on, ends_on)
    `)
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .order('created_at');

  if (subjectError) throw subjectError;

  const today = todayIso();
  return {
    id: classRow.id as string,
    nameEn: classRow.name_en as string,
    nameAr: classRow.name_ar as string | null,
    isActive: classRow.is_active as boolean,
    subjects: (subjectRows as unknown as ClassSubjectRow[]).flatMap((row) =>
      row.subjects
        ? [{
            id: row.id,
            subjectId: row.subject_id,
            subjectNameEn: row.subjects.name_en,
            subjectNameAr: row.subjects.name_ar,
            isActive: row.is_active,
            defaultGroupId: row.default_group_id,
            teacherCount: new Set(
              row.teaching_assignments
                .filter(({starts_on, ends_on}) => includesDate(starts_on, ends_on, today))
                .map(({teacher_profile_id}) => teacher_profile_id)
            ).size,
            groups: row.subject_groups
              .map((group) => ({
                id: group.id,
                nameEn: group.name_en,
                nameAr: group.name_ar,
                isActive: group.is_active,
                isDefault: group.id === row.default_group_id
              }))
              .sort((left, right) => left.nameEn.localeCompare(right.nameEn))
          }]
        : []
    )
  };
}

export async function listSubjects(schoolId: string): Promise<SubjectOption[]> {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('subjects')
    .select('id, name_en, name_ar')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('name_en');

  if (error) throw error;

  return (data as Array<{id: string; name_en: string; name_ar: string | null}>).map(
    (row) => ({id: row.id, nameEn: row.name_en, nameAr: row.name_ar})
  );
}

export async function insertClass(schoolId: string, input: ClassInput) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('classes')
    .insert({school_id: schoolId, name_en: input.nameEn, name_ar: input.nameAr})
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function insertSubject(schoolId: string, input: SubjectInput) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('subjects')
    .insert({school_id: schoolId, name_en: input.nameEn, name_ar: input.nameAr})
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function insertClassSubject(
  schoolId: string,
  classId: string,
  input: ClassSubjectInput
) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('class_subjects')
    .insert({school_id: schoolId, class_id: classId, subject_id: input.subjectId})
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function insertSubjectGroup(input: SubjectGroupInput) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase.rpc('create_subject_group', {
    p_class_subject_id: input.classSubjectId,
    p_name_en: input.nameEn,
    p_name_ar: input.nameAr
  });
  if (error) throw error;
  return data as string;
}

export async function updateDefaultGroup(
  schoolId: string,
  input: DefaultGroupInput
) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase
    .from('class_subjects')
    .update({default_group_id: input.subjectGroupId})
    .eq('school_id', schoolId)
    .eq('id', input.classSubjectId);
  if (error) throw error;
}
