import 'server-only';

import type {
  EndTeachingAssignmentInput,
  TeachingAssignmentInput
} from '@/features/teaching-assignments/teaching-assignment.schemas';
import {expandEffectiveTeachingContexts} from '@/features/teaching-assignments/teaching-assignment.service';
import type {
  EffectiveTeachingContext,
  TeachingAssignment,
  TeachingClassSubject
} from '@/features/teaching-assignments/teaching-assignment.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type AssignmentRow = {
  id: string;
  teacher_profile_id: string;
  class_subject_id: string;
  subject_group_id: string | null;
  starts_on: string;
  ends_on: string | null;
};

type ClassSubjectRow = {
  id: string;
  is_active: boolean;
  classes: {name_en: string; name_ar: string | null; is_active: boolean} | null;
  subjects: {name_en: string; name_ar: string | null; is_active: boolean} | null;
  subject_groups: Array<{
    id: string;
    name_en: string;
    name_ar: string | null;
    is_active: boolean;
  }>;
};

export async function listTeachingClassSubjects(schoolId: string): Promise<TeachingClassSubject[]> {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('class_subjects')
    .select(`
      id,
      is_active,
      classes(name_en, name_ar, is_active),
      subjects(name_en, name_ar, is_active),
      subject_groups(id, name_en, name_ar, is_active)
    `)
    .eq('school_id', schoolId)
    .eq('is_active', true);
  if (error) throw error;

  return (data as unknown as ClassSubjectRow[]).flatMap((row) => {
    if (!row.classes?.is_active || !row.subjects?.is_active) return [];
    return [{
      id: row.id,
      classNameEn: row.classes.name_en,
      classNameAr: row.classes.name_ar,
      subjectNameEn: row.subjects.name_en,
      subjectNameAr: row.subjects.name_ar,
      isActive: row.is_active,
      groups: row.subject_groups
        .filter(({is_active}) => is_active)
        .map((group) => ({
          id: group.id,
          nameEn: group.name_en,
          nameAr: group.name_ar,
          isActive: group.is_active
        }))
        .sort((left, right) => left.nameEn.localeCompare(right.nameEn))
    }];
  }).sort((left, right) =>
    left.classNameEn.localeCompare(right.classNameEn) ||
    left.subjectNameEn.localeCompare(right.subjectNameEn)
  );
}

export async function listTeachingAssignments(
  schoolId: string,
  teacherProfileId: string
): Promise<TeachingAssignment[]> {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('teaching_assignments')
    .select('id, teacher_profile_id, class_subject_id, subject_group_id, starts_on, ends_on')
    .eq('school_id', schoolId)
    .eq('teacher_profile_id', teacherProfileId)
    .order('starts_on', {ascending: false});
  if (error) throw error;

  return (data as AssignmentRow[]).map((row) => ({
    id: row.id,
    teacherProfileId: row.teacher_profile_id,
    classSubjectId: row.class_subject_id,
    subjectGroupId: row.subject_group_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on
  }));
}

export async function assignTeacher(
  schoolId: string,
  input: TeachingAssignmentInput
) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.from('teaching_assignments').insert({
    school_id: schoolId,
    teacher_profile_id: input.teacherProfileId,
    class_subject_id: input.classSubjectId,
    subject_group_id: input.subjectGroupId,
    starts_on: input.startsOn
  });
  if (error) throw error;
}

export async function endTeacherAssignment(
  schoolId: string,
  teacherProfileId: string,
  input: EndTeachingAssignmentInput
) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('teaching_assignments')
    .update({ends_on: input.endsOn})
    .eq('school_id', schoolId)
    .eq('teacher_profile_id', teacherProfileId)
    .eq('id', input.assignmentId)
    .lte('starts_on', input.endsOn)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Teaching assignment could not be ended');
}

export async function listEffectiveTeachingContexts({
  schoolId,
  teacherProfileId,
  onDate,
  classSubjects
}: {
  schoolId: string;
  teacherProfileId: string;
  onDate: string;
  classSubjects: TeachingClassSubject[];
}): Promise<EffectiveTeachingContext[]> {
  const assignments = await listTeachingAssignments(schoolId, teacherProfileId);
  return expandEffectiveTeachingContexts({teacherProfileId, assignments, classSubjects, onDate});
}
