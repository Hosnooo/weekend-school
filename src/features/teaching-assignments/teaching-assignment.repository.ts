import 'server-only';

import type {
  DeleteTeachingAssignmentInput,
  EndTeachingAssignmentInput,
  TeachingAssignmentInput,
  UpdateTeachingAssignmentInput
} from '@/features/teaching-assignments/teaching-assignment.schemas';
import {
  expandEffectiveTeachingContexts,
  teachingAssignmentProtectsSubmittedHistory,
  TeachingAssignmentMutationException
} from '@/features/teaching-assignments/teaching-assignment.service';
import type {
  EffectiveTeachingContext,
  TeachingAssignment,
  TeachingClassSubject
} from '@/features/teaching-assignments/teaching-assignment.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type AssignmentRow = {
  id: string;
  teacher_id: string;
  class_subject_id: string;
  subject_group_id: string | null;
  starts_on: string;
  ends_on: string | null;
};

type SubmissionRow = {
  class_subject_id: string;
  subject_group_id: string | null;
  week_start: string;
};

type ClassSubjectRow = {
  id: string;
  is_active: boolean;
  classes: {id: string; name_en: string; name_ar: string | null; is_active: boolean} | null;
  subjects: {name_en: string; name_ar: string | null; is_active: boolean} | null;
  subject_groups: Array<{id: string; name_en: string; name_ar: string | null; is_active: boolean}>;
};

function assignmentFromRow(row: AssignmentRow): TeachingAssignment {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    classSubjectId: row.class_subject_id,
    subjectGroupId: row.subject_group_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on
  };
}

export async function listTeachingClassSubjects(schoolId: string): Promise<TeachingClassSubject[]> {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('class_subjects')
    .select(`
      id,
      is_active,
      classes(id, name_en, name_ar, is_active),
      subjects(name_en, name_ar, is_active),
      subject_groups!subject_groups_class_subject_school_fk(id, name_en, name_ar, is_active)
    `)
    .eq('school_id', schoolId)
    .eq('is_active', true);
  if (error) throw error;

  return (data as unknown as ClassSubjectRow[]).flatMap((row) => {
    if (!row.classes?.is_active || !row.subjects?.is_active) return [];
    return [{
      id: row.id,
      classId: row.classes.id,
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
  teacherId: string
): Promise<TeachingAssignment[]> {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('teaching_assignments')
    .select('id, teacher_id, class_subject_id, subject_group_id, starts_on, ends_on')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .order('starts_on', {ascending: false});
  if (error) throw error;

  return (data as AssignmentRow[]).map(assignmentFromRow);
}

export async function assignTeacher(schoolId: string, input: TeachingAssignmentInput) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.from('teaching_assignments').insert({
    school_id: schoolId,
    teacher_id: input.teacherId,
    class_subject_id: input.classSubjectId,
    subject_group_id: input.subjectGroupId,
    starts_on: input.startsOn,
    ends_on: input.endsOn
  });
  if (error) throw error;
}

export async function updateTeachingAssignmentDates(
  schoolId: string,
  teacherId: string,
  input: UpdateTeachingAssignmentInput
) {
  const supabase = await createServerSupabaseClient();
  const {data: existing, error: existingError} = await supabase
    .from('teaching_assignments')
    .select('id')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .eq('id', input.assignmentId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) {
    throw new TeachingAssignmentMutationException('not-found', 'Teaching assignment not found');
  }

  const {data, error} = await supabase.rpc('update_teaching_assignment_dates', {
    p_teacher_id: teacherId,
    p_assignment_id: input.assignmentId,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn
  });
  if (error) throw error;
  if (!data) {
    throw new TeachingAssignmentMutationException('not-found', 'Teaching assignment not found');
  }
}

export async function deleteTeachingAssignment(
  schoolId: string,
  teacherId: string,
  input: DeleteTeachingAssignmentInput
) {
  const supabase = await createServerSupabaseClient();
  const {data: existing, error: existingError} = await supabase
    .from('teaching_assignments')
    .select('id, teacher_id, class_subject_id, subject_group_id, starts_on, ends_on')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .eq('id', input.assignmentId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) {
    throw new TeachingAssignmentMutationException('not-found', 'Teaching assignment not found');
  }

  const assignment = assignmentFromRow(existing as AssignmentRow);
  const {data: submissions, error: submissionsError} = await supabase
    .from('weekly_submissions')
    .select('class_subject_id, subject_group_id, week_start')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .eq('class_subject_id', assignment.classSubjectId)
    .eq('status', 'SUBMITTED');
  if (submissionsError) throw submissionsError;

  const protectsHistory = (submissions as SubmissionRow[]).some((submission) =>
    teachingAssignmentProtectsSubmittedHistory(assignment, {
      classSubjectId: submission.class_subject_id,
      subjectGroupId: submission.subject_group_id,
      weekStart: submission.week_start
    })
  );
  if (protectsHistory) {
    throw new TeachingAssignmentMutationException(
      'protected-history',
      'Teaching assignment is required by submitted teaching history'
    );
  }

  const {data: deleted, error: deleteError} = await supabase
    .from('teaching_assignments')
    .delete()
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .eq('id', input.assignmentId)
    .select('id')
    .maybeSingle();
  if (deleteError) throw deleteError;
  if (!deleted) {
    throw new TeachingAssignmentMutationException('not-found', 'Teaching assignment not found');
  }
}

export async function endTeacherAssignment(
  schoolId: string,
  teacherId: string,
  input: EndTeachingAssignmentInput
) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('teaching_assignments')
    .update({ends_on: input.endsOn})
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .eq('id', input.assignmentId)
    .lte('starts_on', input.endsOn)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new TeachingAssignmentMutationException('not-found', 'Teaching assignment could not be ended');
  }
}

export async function listEffectiveTeachingContexts({
  schoolId,
  teacherId,
  onDate,
  classSubjects
}: {
  schoolId: string;
  teacherId: string;
  onDate: string;
  classSubjects: TeachingClassSubject[];
}): Promise<EffectiveTeachingContext[]> {
  const assignments = await listTeachingAssignments(schoolId, teacherId);
  return expandEffectiveTeachingContexts({teacherId, assignments, classSubjects, onDate});
}
