import 'server-only';

import type {AttendanceConflict, OfficialAttendanceStatus} from '@/features/attendance/attendance.types';
import {listTeachingClassSubjects} from '@/features/teaching-assignments/teaching-assignment.repository';
import {expandEffectiveTeachingContexts} from '@/features/teaching-assignments/teaching-assignment.service';
import type {TeachingAssignment, TeachingClassSubject} from '@/features/teaching-assignments/teaching-assignment.types';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {createServerSupabaseClient} from '@/lib/supabase/server';

import {
  schoolWeekForDate,
  summarizeActionableDashboard,
  summarizeReportDelivery
} from './dashboard.model';

type TeacherRow = {id: string; display_name: string};
type AssignmentRow = {
  id: string;
  teacher_profile_id: string;
  class_subject_id: string;
  subject_group_id: string | null;
  starts_on: string;
  ends_on: string | null;
};
type StudentRow = {
  id: string;
  first_name_en: string;
  last_name_en: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
};
type WeeklySubmissionStudentRow = {
  student_id: string;
  attendance_status: OfficialAttendanceStatus;
};
type WeeklySubmissionRow = {
  class_subject_id: string;
  subject_group_id: string | null;
  teacher_profile_id: string;
  status: 'DRAFT' | 'SUBMITTED';
  weekly_submission_students: WeeklySubmissionStudentRow[];
};
type ResolutionRow = {
  class_subject_id: string;
  subject_group_id: string | null;
  student_id: string;
};

function toAssignment(row: AssignmentRow): TeachingAssignment {
  return {
    id: row.id,
    teacherProfileId: row.teacher_profile_id,
    classSubjectId: row.class_subject_id,
    subjectGroupId: row.subject_group_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on
  };
}

function attendanceKey(
  classSubjectId: string,
  subjectGroupId: string | null,
  weekStart: string,
  studentId: string
) {
  return `${classSubjectId}:${subjectGroupId ?? 'whole'}:${weekStart}:${studentId}`;
}

function buildAttendanceConflicts({
  weekStart,
  submissions,
  resolutions,
  teachers,
  students,
  classSubjects
}: {
  weekStart: string;
  submissions: WeeklySubmissionRow[];
  resolutions: ResolutionRow[];
  teachers: TeacherRow[];
  students: StudentRow[];
  classSubjects: TeachingClassSubject[];
}): AttendanceConflict[] {
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const studentById = new Map(students.map((student) => [student.id, student]));
  const subjectById = new Map(classSubjects.map((subject) => [subject.id, subject]));
  const resolvedKeys = new Set(resolutions.map((resolution) => attendanceKey(
    resolution.class_subject_id,
    resolution.subject_group_id,
    weekStart,
    resolution.student_id
  )));
  const conflicts = new Map<string, {statuses: Set<OfficialAttendanceStatus>; value: AttendanceConflict}>();

  for (const submission of submissions) {
    if (submission.status !== 'SUBMITTED') continue;
    const subject = subjectById.get(submission.class_subject_id);
    if (!subject) continue;
    const group = submission.subject_group_id
      ? subject.groups.find(({id}) => id === submission.subject_group_id) ?? null
      : null;
    const teacher = teacherById.get(submission.teacher_profile_id);

    for (const observation of submission.weekly_submission_students ?? []) {
      const student = studentById.get(observation.student_id);
      if (!student) continue;
      const key = attendanceKey(
        submission.class_subject_id,
        submission.subject_group_id,
        weekStart,
        observation.student_id
      );
      if (resolvedKeys.has(key)) continue;

      const existing = conflicts.get(key) ?? {
        statuses: new Set<OfficialAttendanceStatus>(),
        value: {
          classSubjectId: submission.class_subject_id,
          subjectGroupId: submission.subject_group_id,
          weekStart,
          studentId: observation.student_id,
          studentNameEn: `${student.first_name_en} ${student.last_name_en}`,
          studentNameAr: student.first_name_ar && student.last_name_ar
            ? `${student.first_name_ar} ${student.last_name_ar}`
            : null,
          classNameEn: subject.classNameEn,
          classNameAr: subject.classNameAr,
          subjectNameEn: subject.subjectNameEn,
          subjectNameAr: subject.subjectNameAr,
          groupNameEn: group?.nameEn ?? null,
          groupNameAr: group?.nameAr ?? null,
          observations: [],
          resolution: null
        }
      };
      existing.statuses.add(observation.attendance_status);
      existing.value.observations.push({
        teacherProfileId: submission.teacher_profile_id,
        teacherName: teacher?.display_name ?? 'Teacher',
        status: observation.attendance_status
      });
      conflicts.set(key, existing);
    }
  }

  return [...conflicts.values()]
    .filter(({statuses}) => statuses.size > 1)
    .map(({value}) => value)
    .sort((left, right) =>
      left.classNameEn.localeCompare(right.classNameEn) ||
      left.subjectNameEn.localeCompare(right.subjectNameEn) ||
      left.studentNameEn.localeCompare(right.studentNameEn)
    );
}

export async function getDashboardSummary(schoolId: string, now = new Date()) {
  const db = await createServerSupabaseClient();
  const {data: school, error: schoolError} = await db
    .from('schools')
    .select('name_en,name_ar,timezone')
    .eq('id', schoolId)
    .single();
  if (schoolError) throw schoolError;

  const week = schoolWeekForDate(todayInTimeZone(school.timezone, now));
  const classSubjectsPromise = listTeachingClassSubjects(schoolId);
  const [students, teachers, assignments, submissions, resolutions, reports, deliveries, classSubjects] = await Promise.all([
    db.from('students')
      .select('id,first_name_en,last_name_en,first_name_ar,last_name_ar')
      .eq('school_id', schoolId)
      .eq('is_active', true),
    db.from('profiles')
      .select('id,display_name')
      .eq('school_id', schoolId)
      .eq('role', 'TEACHER')
      .eq('is_active', true),
    db.from('teaching_assignments')
      .select('id,teacher_profile_id,class_subject_id,subject_group_id,starts_on,ends_on')
      .eq('school_id', schoolId)
      .lte('starts_on', week.start)
      .or(`ends_on.is.null,ends_on.gte.${week.start}`),
    db.from('weekly_submissions')
      .select('class_subject_id,subject_group_id,teacher_profile_id,status,weekly_submission_students(student_id,attendance_status)')
      .eq('school_id', schoolId)
      .eq('week_start', week.start),
    db.from('attendance_resolutions')
      .select('class_subject_id,subject_group_id,student_id')
      .eq('school_id', schoolId)
      .eq('week_start', week.start),
    db.from('reports').select('status').eq('school_id', schoolId).eq('status', 'READY'),
    db.from('email_deliveries').select('status').eq('school_id', schoolId).eq('status', 'FAILED'),
    classSubjectsPromise
  ]);

  if (students.error) throw students.error;
  if (teachers.error) throw teachers.error;
  if (assignments.error) throw assignments.error;
  if (submissions.error) throw submissions.error;
  if (resolutions.error) throw resolutions.error;
  if (reports.error) throw reports.error;
  if (deliveries.error) throw deliveries.error;

  const studentRows = students.data as StudentRow[];
  const teacherRows = teachers.data as TeacherRow[];
  const assignmentRows = (assignments.data as AssignmentRow[]).map(toAssignment);
  const submissionRows = submissions.data as unknown as WeeklySubmissionRow[];
  const resolutionRows = resolutions.data as ResolutionRow[];

  const expectedContexts = teacherRows.flatMap((teacher) =>
    expandEffectiveTeachingContexts({
      teacherProfileId: teacher.id,
      assignments: assignmentRows,
      classSubjects,
      onDate: week.start
    }).map((context) => ({
      teacherProfileId: teacher.id,
      classSubjectId: context.classSubjectId,
      subjectGroupId: context.subjectGroupId
    }))
  );

  const teachingSubmissions = submissionRows.map((submission) => ({
    teacherProfileId: submission.teacher_profile_id,
    classSubjectId: submission.class_subject_id,
    subjectGroupId: submission.subject_group_id,
    status: submission.status
  }));
  const observations = submissionRows
    .filter(({status}) => status === 'SUBMITTED')
    .flatMap((submission) => (submission.weekly_submission_students ?? []).map((observation) => ({
      classSubjectId: submission.class_subject_id,
      subjectGroupId: submission.subject_group_id,
      weekStart: week.start,
      studentId: observation.student_id,
      status: observation.attendance_status
    })));
  const resolutionContexts = resolutionRows.map((resolution) => ({
    classSubjectId: resolution.class_subject_id,
    subjectGroupId: resolution.subject_group_id,
    weekStart: week.start,
    studentId: resolution.student_id
  }));
  const activity = summarizeActionableDashboard({
    expectedContexts,
    submissions: teachingSubmissions,
    observations,
    resolutions: resolutionContexts
  });
  const conflicts = buildAttendanceConflicts({
    weekStart: week.start,
    submissions: submissionRows,
    resolutions: resolutionRows,
    teachers: teacherRows,
    students: studentRows,
    classSubjects
  });

  return {
    schoolNameEn: school.name_en,
    schoolNameAr: school.name_ar,
    studentCount: studentRows.length,
    teacherCount: teacherRows.length,
    ...summarizeReportDelivery(reports.data, deliveries.data),
    ...week,
    ...activity,
    conflicts
  };
}
