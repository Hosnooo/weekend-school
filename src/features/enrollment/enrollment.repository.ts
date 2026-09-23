import 'server-only';

import type {
  ChangeStudentClassInput,
  CreateStudentEnrollmentInput,
  MoveStudentSubjectGroupInput,
  SetSubjectExcludedInput
} from '@/features/enrollment/enrollment.schemas';
import {deriveSubjectParticipation} from '@/features/enrollment/enrollment.service';
import type {
  EnrollmentClassOption,
  EnrollmentGroupMembership,
  EnrollmentSubjectExclusion,
  StudentEnrollmentState
} from '@/features/enrollment/enrollment.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type ClassRow = {
  id: string;
  name_en: string;
  name_ar: string | null;
  is_active: boolean;
  class_subjects: Array<{
    id: string;
    default_group_id: string | null;
    is_active: boolean;
    subjects: {name_en: string; name_ar: string | null} | null;
    subject_groups: Array<{
      id: string;
      name_en: string;
      name_ar: string | null;
      is_active: boolean;
    }>;
  }>;
};

export async function listEnrollmentClasses(schoolId: string): Promise<EnrollmentClassOption[]> {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('classes')
    .select(`
      id,
      name_en,
      name_ar,
      is_active,
      class_subjects(
        id,
        default_group_id,
        is_active,
        subjects(name_en, name_ar),
        subject_groups(id, name_en, name_ar, is_active)
      )
    `)
    .eq('school_id', schoolId)
    .order('name_en');

  if (error) throw error;

  return (data as unknown as ClassRow[]).map((row) => ({
    id: row.id,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    isActive: row.is_active,
    subjects: row.class_subjects.flatMap((classSubject) =>
      classSubject.subjects
        ? [{
            id: classSubject.id,
            nameEn: classSubject.subjects.name_en,
            nameAr: classSubject.subjects.name_ar,
            isActive: classSubject.is_active,
            defaultGroupId: classSubject.default_group_id,
            groups: classSubject.subject_groups
              .map((group) => ({
                id: group.id,
                nameEn: group.name_en,
                nameAr: group.name_ar,
                isActive: group.is_active
              }))
              .sort((left, right) => left.nameEn.localeCompare(right.nameEn))
          }]
        : []
    )
  }));
}

export async function getStudentEnrollmentState(
  schoolId: string,
  studentId: string,
  onDate: string
): Promise<StudentEnrollmentState> {
  const supabase = await createServerSupabaseClient();
  const [classes, enrollmentResult, exclusionsResult, membershipsResult] = await Promise.all([
    listEnrollmentClasses(schoolId),
    supabase
      .from('class_enrollments')
      .select('class_id, starts_on, ends_on')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .lte('starts_on', onDate)
      .or(`ends_on.is.null,ends_on.gte.${onDate}`)
      .order('starts_on', {ascending: false})
      .limit(1)
      .maybeSingle(),
    supabase
      .from('subject_exclusions')
      .select('class_subject_id, starts_on, ends_on')
      .eq('school_id', schoolId)
      .eq('student_id', studentId),
    supabase
      .from('subject_group_memberships')
      .select('class_subject_id, subject_group_id, starts_on, ends_on')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
  ]);

  if (enrollmentResult.error) throw enrollmentResult.error;
  if (exclusionsResult.error) throw exclusionsResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  const enrollment = enrollmentResult.data as {
    class_id: string;
    starts_on: string;
    ends_on: string | null;
  } | null;
  const currentClass = enrollment
    ? classes.find(({id}) => id === enrollment.class_id) ?? null
    : null;
  const exclusions: EnrollmentSubjectExclusion[] = (exclusionsResult.data ?? []).map((row) => ({
    classSubjectId: row.class_subject_id as string,
    startsOn: row.starts_on as string,
    endsOn: row.ends_on as string | null
  }));
  const memberships: EnrollmentGroupMembership[] = (membershipsResult.data ?? []).map((row) => ({
    classSubjectId: row.class_subject_id as string,
    subjectGroupId: row.subject_group_id as string,
    startsOn: row.starts_on as string,
    endsOn: row.ends_on as string | null
  }));

  return {
    currentClass,
    currentEnrollment: enrollment ? {
      classId: enrollment.class_id,
      startsOn: enrollment.starts_on,
      endsOn: enrollment.ends_on
    } : null,
    exclusions,
    memberships,
    participation: currentClass
      ? deriveSubjectParticipation({
          classSubjects: currentClass.subjects,
          exclusions,
          memberships,
          onDate
        })
      : []
  };
}

export async function createStudentWithEnrollment(input: CreateStudentEnrollmentInput) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase.rpc('create_student_with_enrollment', {
    p_first_name_en: input.firstNameEn,
    p_last_name_en: input.lastNameEn,
    p_first_name_ar: input.firstNameAr ?? '',
    p_last_name_ar: input.lastNameAr ?? '',
    p_guardian_name: input.guardianName,
    p_guardian_email: input.guardianEmail,
    p_report_language: input.reportLanguage,
    p_class_id: input.classId,
    p_starts_on: input.startsOn,
    p_subject_preferences: input.subjects.map((subject) => ({
      classSubjectId: subject.classSubjectId,
      included: subject.included,
      groupId: subject.groupId
    }))
  });
  if (error) throw error;
  if (!data) throw new Error('Student enrollment creation returned no id');
  return data as string;
}

export async function changeStudentClass(input: ChangeStudentClassInput) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('change_student_class', {
    p_student_id: input.studentId,
    p_target_class_id: input.targetClassId,
    p_starts_on: input.startsOn
  });
  if (error) throw error;
}

export async function setSubjectExcluded(input: SetSubjectExcludedInput) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('set_student_subject_excluded', {
    p_student_id: input.studentId,
    p_class_subject_id: input.classSubjectId,
    p_excluded: input.excluded,
    p_effective_on: input.effectiveOn
  });
  if (error) throw error;
}

export async function moveStudentSubjectGroup(input: MoveStudentSubjectGroupInput) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('move_student_subject_group', {
    p_student_id: input.studentId,
    p_class_subject_id: input.classSubjectId,
    p_target_group_id: input.targetGroupId,
    p_starts_on: input.startsOn
  });
  if (error) throw error;
}
