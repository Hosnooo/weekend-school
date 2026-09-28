import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';

import type {
  RosterExportRow,
  RosterExportSubject
} from './roster-export.service';

export type RosterExportScope =
  | {type: 'SCHOOL'}
  | {type: 'CLASS'; classId: string};

export type RosterExportData = {
  subjects: RosterExportSubject[];
  rows: RosterExportRow[];
};

type StudentRow = {
  id: string;
  first_name_en: string;
  last_name_en: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
  is_active: boolean;
};

type ClassRow = {
  id: string;
  name_en: string;
  is_active: boolean;
};

type EnrollmentRow = {
  class_id: string;
  student_id: string;
  starts_on: string;
  ends_on: string | null;
};

type SubjectRow = {
  id: string;
  name_en: string;
  is_active: boolean;
};

type ClassSubjectRow = {
  id: string;
  class_id: string;
  subject_id: string;
  is_active: boolean;
};

type MembershipRow = {
  class_subject_id: string;
  subject_group_id: string;
  student_id: string;
  starts_on: string;
  ends_on: string | null;
};

type GroupRow = {
  id: string;
  class_subject_id: string;
  name_en: string;
};

type StudentGuardianRow = {
  student_id: string;
  guardian_id: string;
  is_primary: boolean;
};

type GuardianRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  report_language: string;
};

function currentOn(
  startsOn: string,
  endsOn: string | null,
  onDate: string
) {
  return startsOn <= onDate && (!endsOn || endsOn >= onDate);
}

function requireResult(
  error: {message?: string; code?: string} | null
) {
  if (error) throw error;
}

export async function collectRosterExportRows(
  schoolId: string,
  scope: RosterExportScope,
  onDate: string
): Promise<RosterExportData> {
  const db = await createServerSupabaseClient();

  const [
    studentsResult,
    classesResult,
    enrollmentsResult,
    subjectsResult,
    classSubjectsResult,
    membershipsResult,
    groupsResult,
    studentGuardiansResult,
    guardiansResult
  ] = await Promise.all([
    db
      .from('students')
      .select(`
        id,
        first_name_en,
        last_name_en,
        first_name_ar,
        last_name_ar,
        is_active
      `)
      .eq('school_id', schoolId),

    db
      .from('classes')
      .select('id, name_en, is_active')
      .eq('school_id', schoolId),

    db
      .from('class_enrollments')
      .select('class_id, student_id, starts_on, ends_on')
      .eq('school_id', schoolId)
      .lte('starts_on', onDate)
      .or(`ends_on.is.null,ends_on.gte.${onDate}`),

    db
      .from('subjects')
      .select('id, name_en, is_active')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name_en'),

    db
      .from('class_subjects')
      .select('id, class_id, subject_id, is_active')
      .eq('school_id', schoolId)
      .eq('is_active', true),

    db
      .from('subject_group_memberships')
      .select(`
        class_subject_id,
        subject_group_id,
        student_id,
        starts_on,
        ends_on
      `)
      .eq('school_id', schoolId)
      .lte('starts_on', onDate)
      .or(`ends_on.is.null,ends_on.gte.${onDate}`),

    db
      .from('subject_groups')
      .select('id, class_subject_id, name_en')
      .eq('school_id', schoolId),

    db
      .from('student_guardians')
      .select('student_id, guardian_id, is_primary')
      .eq('school_id', schoolId)
      .eq('is_primary', true),

    db
      .from('guardians')
      .select('id, name, email, phone, report_language')
      .eq('school_id', schoolId)
  ]);

  for (const result of [
    studentsResult,
    classesResult,
    enrollmentsResult,
    subjectsResult,
    classSubjectsResult,
    membershipsResult,
    groupsResult,
    studentGuardiansResult,
    guardiansResult
  ]) {
    requireResult(result.error);
  }

  const students = (studentsResult.data ?? []) as StudentRow[];
  const classes = (classesResult.data ?? []) as ClassRow[];
  const enrollments =
    (enrollmentsResult.data ?? []) as EnrollmentRow[];
  const subjects = (subjectsResult.data ?? []) as SubjectRow[];
  const classSubjects =
    (classSubjectsResult.data ?? []) as ClassSubjectRow[];
  const memberships =
    (membershipsResult.data ?? []) as MembershipRow[];
  const groups = (groupsResult.data ?? []) as GroupRow[];
  const studentGuardians =
    (studentGuardiansResult.data ?? []) as StudentGuardianRow[];
  const guardians = (guardiansResult.data ?? []) as GuardianRow[];

  const activeClasses = new Map(
    classes
      .filter((row) => row.is_active)
      .map((row) => [row.id, row])
  );

  if (
    scope.type === 'CLASS' &&
    !activeClasses.has(scope.classId)
  ) {
    throw new Error('Roster Class not found');
  }

  const studentMap = new Map(
    students
      .filter((student) => student.is_active)
      .map((student) => [student.id, student])
  );

  const guardianMap = new Map(
    guardians.map((guardian) => [guardian.id, guardian])
  );

  const primaryGuardianByStudent = new Map(
    studentGuardians
      .filter((link) => link.is_primary)
      .map((link) => [link.student_id, link.guardian_id])
  );

  const classSubjectsByClass = new Map<
    string,
    ClassSubjectRow[]
  >();

  for (const classSubject of classSubjects) {
    const list =
      classSubjectsByClass.get(classSubject.class_id) ?? [];
    list.push(classSubject);
    classSubjectsByClass.set(classSubject.class_id, list);
  }

  const groupMap = new Map(
    groups.map((group) => [group.id, group])
  );

  const currentMembershipByKey = new Map<string, MembershipRow>();

  for (const membership of memberships) {
    if (
      !currentOn(
        membership.starts_on,
        membership.ends_on,
        onDate
      )
    ) {
      continue;
    }

    currentMembershipByKey.set(
      `${membership.student_id}:${membership.class_subject_id}`,
      membership
    );
  }

  const currentEnrollments = enrollments
    .filter((enrollment) =>
      currentOn(
        enrollment.starts_on,
        enrollment.ends_on,
        onDate
      )
    )
    .filter((enrollment) =>
      scope.type === 'SCHOOL'
        ? true
        : enrollment.class_id === scope.classId
    )
    .filter((enrollment) =>
      activeClasses.has(enrollment.class_id)
    )
    .filter((enrollment) =>
      studentMap.has(enrollment.student_id)
    )
    .sort((left, right) => {
      const leftStudent = studentMap.get(left.student_id)!;
      const rightStudent = studentMap.get(right.student_id)!;

      return (
        leftStudent.last_name_en.localeCompare(
          rightStudent.last_name_en
        ) ||
        leftStudent.first_name_en.localeCompare(
          rightStudent.first_name_en
        )
      );
    });

  const rows: RosterExportRow[] = currentEnrollments.map(
    (enrollment) => {
      const student = studentMap.get(enrollment.student_id)!;
      const classRow = activeClasses.get(enrollment.class_id)!;

      const guardianId =
        primaryGuardianByStudent.get(student.id) ?? null;

      const guardian = guardianId
        ? guardianMap.get(guardianId) ?? null
        : null;

      const groupsBySubject: RosterExportRow['groups'] = {};

      const attachedSubjects =
        classSubjectsByClass.get(classRow.id) ?? [];

      for (const classSubject of attachedSubjects) {
        const membership = currentMembershipByKey.get(
          `${student.id}:${classSubject.id}`
        );

        if (!membership) {
          groupsBySubject[classSubject.subject_id] = null;
          continue;
        }

        const group = groupMap.get(
          membership.subject_group_id
        );

        if (
          !group ||
          group.class_subject_id !== classSubject.id
        ) {
          groupsBySubject[classSubject.subject_id] = null;
          continue;
        }

        groupsBySubject[classSubject.subject_id] = {
          groupId: group.id,
          groupName: group.name_en
        };
      }

      return {
        studentId: student.id,
        firstNameEn: student.first_name_en,
        lastNameEn: student.last_name_en,
        firstNameAr: student.first_name_ar,
        lastNameAr: student.last_name_ar,
        guardianId: guardian?.id ?? null,
        guardianName: guardian?.name ?? null,
        guardianEmail: guardian?.email ?? null,
        guardianPhone: guardian?.phone ?? null,
        reportLanguage: guardian?.report_language ?? null,
        classId: classRow.id,
        className: classRow.name_en,
        enrollmentStartDate: enrollment.starts_on,
        groups: groupsBySubject
      };
    }
  );

  return {
    subjects: subjects.map((subject) => ({
      id: subject.id,
      nameEn: subject.name_en
    })),
    rows
  };
}

export async function getRosterSchoolTimezone(
  schoolId: string
): Promise<string> {
  const db = await createServerSupabaseClient();

  const {data, error} = await db
    .from('schools')
    .select('timezone')
    .eq('id', schoolId)
    .single();

  if (error) throw error;

  return data.timezone as string;
}
