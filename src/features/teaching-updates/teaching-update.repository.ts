import 'server-only';

import type {SupabaseClient} from '@supabase/supabase-js';

import {createServerSupabaseClient} from '@/lib/supabase/server';
import type {
  TeachingUpdate,
  TeachingUpdateCoverageKind,
  TeachingUpdateOverlap,
  TeachingUpdateStatus,
  TeachingUpdateStorageStatus
} from './teaching-update.types';
import type {TeachingUpdateDraftInput} from './teaching-update.schemas';
import {toDatabasePayload, toSparseExceptions} from '@/features/weekly-updates/weekly-update.model';

function applicationStatus(
  status: TeachingUpdateStorageStatus
): TeachingUpdateStatus {
  return status === 'DRAFT' ? 'OPEN' : status;
}

async function teacherCanAccessTeachingUpdate(
  db: SupabaseClient,
  teacherIds: string[],
  submission: {
    teacher_id: string | null;
    request_set_id: string | null;
    class_subject_id: string;
    subject_group_id: string | null;
    period_start: string;
    period_end: string;
  }
) {
  if (submission.teacher_id !== null) {
    return teacherIds.includes(submission.teacher_id);
  }

  if (submission.request_set_id === null) return false;

  const checks = await Promise.all(
    teacherIds.map(async (teacherId) => {
      const {data, error} = await db.rpc(
        'teacher_can_teach_period_context',
        {
          p_teacher_id: teacherId,
          p_class_subject_id: submission.class_subject_id,
          p_subject_group_id: submission.subject_group_id,
          p_period_start: submission.period_start,
          p_period_end: submission.period_end
        }
      );
      if (error) throw error;
      return data === true;
    })
  );

  return checks.some(Boolean);
}

export async function saveTeachingUpdateDraft(
  input: TeachingUpdateDraftInput
) {
  const db = await createServerSupabaseClient();
  const payload = toDatabasePayload(input.attendance, toSparseExceptions(input.exceptions));
  const {data, error} = await db.rpc(
    'save_teaching_update_draft',
    {
      p_teacher_id: input.teacherId,
      p_submission_id: input.submissionId,
      p_class_subject_id: input.classSubjectId,
      p_subject_group_id: input.subjectGroupId,
      p_coverage_kind: input.coverageKind,
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
      p_dates:
        input.coverageKind === 'DATES'
          ? input.dates
          : [],
      p_progress_en: input.progressEn ?? '',
      p_progress_ar: input.progressAr ?? '',
      p_default_performance:
        input.defaultPerformance,
      p_attendance: payload.attendance,
      p_exceptions: payload.exceptions,
      p_expected_version: input.expectedVersion
    }
  );

  if (error) throw error;
  return data as string;
}

export async function findOverlappingTeachingUpdates(
  input: {
    classSubjectId: string;
    subjectGroupId: string | null;
    periodStart: string;
    periodEnd: string;
  }
): Promise<TeachingUpdateOverlap[]> {
  const db = await createServerSupabaseClient();
  const {data, error} = await db.rpc(
    'find_overlapping_teaching_updates',
    {
      p_class_subject_id: input.classSubjectId,
      p_subject_group_id: input.subjectGroupId,
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd
    }
  );

  if (error) throw error;

  return (data ?? []).map((row: {
    id: string;
    subject_group_id: string | null;
    coverage_kind: TeachingUpdateCoverageKind;
    period_start: string;
    period_end: string;
    status: TeachingUpdateStorageStatus;
  }) => ({
    id: row.id,
    subjectGroupId: row.subject_group_id,
    coverageKind: row.coverage_kind,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: applicationStatus(row.status)
  }));
}

export async function submitTeachingUpdate(
  input: {
    submissionId: string;
    teacherId: string;
    expectedVersion: number;
  }
) {
  const db = await createServerSupabaseClient();
  const {error} = await db.rpc(
    'submit_teaching_update',
    {
      p_submission_id: input.submissionId,
      p_teacher_id: input.teacherId,
      p_expected_version: input.expectedVersion
    }
  );

  if (error) throw error;
}

export async function dismissTeachingUpdate(
  input: {
    submissionId: string;
    reason: string | null;
    expectedVersion: number;
  }
) {
  const db = await createServerSupabaseClient();
  const {error} = await db.rpc(
    'dismiss_teaching_update',
    {
      p_submission_id: input.submissionId,
      p_reason: input.reason,
      p_expected_version: input.expectedVersion
    }
  );

  if (error) throw error;
}

type TeachingUpdateSubmissionRow = {
  id: string;
  teacher_id: string | null;
  status: TeachingUpdateStorageStatus;
  coverage_kind: TeachingUpdateCoverageKind;
  period_start: string;
  period_end: string;
  version: number;
  request_set_id: string | null;
  requested_by_profile_id: string | null;
  admin_note: string | null;
  dismissal_reason: string | null;
  submitted_at: string | null;
  progress_en: string | null;
  progress_ar: string | null;
  default_performance:
    | 'EXCELLENT'
    | 'GOOD'
    | 'DEVELOPING'
    | 'NEEDS_SUPPORT'
    | null;
  class_subject_id: string;
  subject_group_id: string | null;
};

export type TeachingUpdateListItem = {
  id: string;
  teacherId: string | null;
  classSubjectId: string;
  subjectGroupId: string | null;
  coverageKind: TeachingUpdateCoverageKind;
  periodStart: string;
  periodEnd: string;
  version: number;
  requestSetId: string | null;
  adminNote: string | null;
};

export type SubmittedTeachingUpdateHistoryItem = {
  id: string;
  teacherId: string;
  coverageKind: TeachingUpdateCoverageKind;
  periodStart: string;
  periodEnd: string;
  submittedAt: string | null;
  classNameEn: string;
  classNameAr: string | null;
  subjectNameEn: string;
  subjectNameAr: string | null;
  subjectGroupId: string | null;
  groupNameEn: string | null;
  groupNameAr: string | null;
};

type ContextRow = {
  class_subject_id: string;
  subject_group_id: string | null;
  class_name_en: string;
  class_name_ar: string | null;
  subject_name_en: string;
  subject_name_ar: string | null;
  group_name_en: string | null;
  group_name_ar: string | null;
};

export async function listSubmittedTeachingUpdates(
  schoolId: string,
  teacherIds: string[]
): Promise<SubmittedTeachingUpdateHistoryItem[]> {
  if (teacherIds.length === 0) return [];

  const db = await createServerSupabaseClient();
  const {data, error} = await db
    .from('weekly_submissions')
    .select('id,teacher_id,coverage_kind,period_start,period_end,submitted_at')
    .eq('school_id', schoolId)
    .in('teacher_id', teacherIds)
    .eq('status', 'SUBMITTED')
    .order('submitted_at', {ascending: false});
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    teacher_id: string;
    coverage_kind: TeachingUpdateCoverageKind;
    period_start: string;
    period_end: string;
    submitted_at: string | null;
  }>;

  const history = await Promise.all(rows.map(async (row) => {
    const {data: contextData, error: contextError} = await db.rpc(
      'get_weekly_submission_context',
      {p_submission_id: row.id}
    );
    if (contextError) throw contextError;
    const context = (contextData as ContextRow[] | null)?.[0];
    if (!context) return null;
    return {
      id: row.id,
      teacherId: row.teacher_id,
      coverageKind: row.coverage_kind,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      submittedAt: row.submitted_at,
      classNameEn: context.class_name_en,
      classNameAr: context.class_name_ar,
      subjectNameEn: context.subject_name_en,
      subjectNameAr: context.subject_name_ar,
      subjectGroupId: context.subject_group_id,
      groupNameEn: context.group_name_en,
      groupNameAr: context.group_name_ar
    };
  }));
  return history.filter((item): item is SubmittedTeachingUpdateHistoryItem => item !== null);
}

export async function getTeachingUpdate(
  schoolId: string,
  teacherIds: string[],
  submissionId: string
): Promise<TeachingUpdate | null> {
  if (teacherIds.length === 0) return null;

  const db = await createServerSupabaseClient();

  const {data: rawSubmissionData, error: submissionError} =
    await db
      .from('weekly_submissions')
      .select(
        [
          'id',
          'teacher_id',
          'status',
          'coverage_kind',
          'period_start',
          'period_end',
          'version',
          'request_set_id',
          'requested_by_profile_id',
          'admin_note',
          'dismissal_reason',
          'submitted_at',
          'progress_en',
          'progress_ar',
          'default_performance',
          'class_subject_id',
          'subject_group_id'
        ].join(',')
      )
      .eq('school_id', schoolId)
      .eq('id', submissionId)
      .maybeSingle();

  if (submissionError) throw submissionError;

  const submissionData =
    rawSubmissionData as unknown as TeachingUpdateSubmissionRow | null;

  if (!submissionData) return null;

  if (!(await teacherCanAccessTeachingUpdate(db, teacherIds, submissionData))) {
    return null;
  }

  const teacherId = submissionData.teacher_id as string | null;

  const [
    contextResult,
    datesResult,
    studentsResult,
    rosterResult
  ] = await Promise.all([
    db.rpc('get_weekly_submission_context', {
      p_submission_id: submissionId
    }),
    db
      .from('weekly_submission_dates')
      .select('covered_on')
      .eq('school_id', schoolId)
      .eq('submission_id', submissionId)
      .order('covered_on'),
    db
      .from('weekly_submission_students')
      .select(
        'student_id,attendance_status,performance_override,comment_en,comment_ar'
      )
      .eq('school_id', schoolId)
      .eq('submission_id', submissionId),
    db.rpc('get_weekly_submission_roster', {
      p_class_subject_id:
        submissionData.class_subject_id,
      p_subject_group_id:
        submissionData.subject_group_id,
      p_on_date: submissionData.period_end
    })
  ]);

  if (contextResult.error) throw contextResult.error;
  if (datesResult.error) throw datesResult.error;
  if (studentsResult.error) throw studentsResult.error;
  if (rosterResult.error) throw rosterResult.error;

  const context =
    (contextResult.data as ContextRow[] | null)?.[0];

  if (!context) return null;

  const observations =
    studentsResult.data as Array<{
      student_id: string;
      attendance_status: 'PRESENT' | 'ABSENT';
      performance_override:
        | 'EXCELLENT'
        | 'GOOD'
        | 'DEVELOPING'
        | 'NEEDS_SUPPORT'
        | null;
      comment_en: string | null;
      comment_ar: string | null;
    }>;

  return {
    id: submissionData.id as string,
    teacherId,
    classSubjectId: context.class_subject_id,
    subjectGroupId: context.subject_group_id,
    classNameEn: context.class_name_en,
    classNameAr: context.class_name_ar,
    subjectNameEn: context.subject_name_en,
    subjectNameAr: context.subject_name_ar,
    groupNameEn: context.group_name_en,
    groupNameAr: context.group_name_ar,
    coverageKind:
      submissionData.coverage_kind as TeachingUpdateCoverageKind,
    periodStart:
      submissionData.period_start as string,
    periodEnd:
      submissionData.period_end as string,
    dates: (datesResult.data ?? []).map(
      (row) => row.covered_on as string
    ),
    status: applicationStatus(
      submissionData.status as TeachingUpdateStorageStatus
    ),
    version: submissionData.version as number,
    requestSetId:
      submissionData.request_set_id as string | null,
    requestedByProfileId:
      submissionData.requested_by_profile_id as string | null,
    adminNote:
      submissionData.admin_note as string | null,
    dismissalReason:
      submissionData.dismissal_reason as string | null,
    submittedAt:
      submissionData.submitted_at as string | null,
    progressEn:
      submissionData.progress_en as string | null,
    progressAr:
      submissionData.progress_ar as string | null,
    defaultPerformance:
      submissionData.default_performance as TeachingUpdate['defaultPerformance'],
    roster: (
      rosterResult.data as Array<{
        student_id: string;
        first_name_en: string;
        last_name_en: string;
        first_name_ar: string | null;
        last_name_ar: string | null;
      }>
    ).map((row) => ({
      id: row.student_id,
      nameEn:
        `${row.first_name_en} ${row.last_name_en}`,
      nameAr:
        row.first_name_ar && row.last_name_ar
          ? `${row.first_name_ar} ${row.last_name_ar}`
          : null
    })),
    attendance: observations.map((row) => ({
      studentId: row.student_id,
      status: row.attendance_status
    })),
    exceptions: observations.flatMap((row) =>
      row.performance_override ||
      row.comment_en ||
      row.comment_ar
        ? [{
            studentId: row.student_id,
            performanceOverride:
              row.performance_override,
            commentEn: row.comment_en,
            commentAr: row.comment_ar
          }]
        : []
    )
  };
}

export async function listOpenTeachingUpdates(
  schoolId: string,
  teacherIds: string[]
): Promise<TeachingUpdateListItem[]> {
  if (teacherIds.length === 0) return [];

  const db = await createServerSupabaseClient();

  const {data, error} = await db
    .from('weekly_submissions')
    .select('*')
    .eq('school_id', schoolId)
    .eq('status', 'DRAFT')
    .order('week_start', {ascending: false});

  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    teacher_id: string | null;
    class_subject_id: string;
    subject_group_id: string | null;
    coverage_kind: TeachingUpdateCoverageKind;
    period_start: string;
    period_end: string;
    version: number;
    request_set_id: string | null;
    admin_note: string | null;
  }>;

  const teacherScopedRows = await Promise.all(
    rows.map(async (row) =>
      (await teacherCanAccessTeachingUpdate(db, teacherIds, row))
        ? row
        : null
    )
  );

  return teacherScopedRows
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .map((row) => ({
      id: row.id,
      teacherId: row.teacher_id,
      classSubjectId: row.class_subject_id,
      subjectGroupId: row.subject_group_id,
      coverageKind: row.coverage_kind,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      version: row.version,
      requestSetId: row.request_set_id,
      adminNote: row.admin_note
    }));
}
