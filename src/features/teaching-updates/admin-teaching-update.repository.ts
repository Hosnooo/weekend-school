import 'server-only';

import type {SupabaseClient} from '@supabase/supabase-js';

import {listEnrollmentClasses} from '@/features/enrollment/enrollment.repository';
import {createServerSupabaseClient} from '@/lib/supabase/server';

import type {
  AdminTeachingUpdate,
  AdminTeachingUpdateContext,
  AdminTeachingUpdateCoverageKind,
  AdminTeachingUpdateRequestSet,
  AdminTeachingUpdateStatus
} from './admin-teaching-update.types';

type SubmissionRow = {
  id: string;
  teacher_id: string | null;
  class_subject_id: string;
  subject_group_id: string | null;
  request_set_id: string | null;
  coverage_kind: string | null;
  period_start: string | null;
  period_end: string | null;
  week_start: string;
  status: string;
  progress_en: string | null;
  progress_ar: string | null;
  created_by_profile_id: string | null;
  requested_by_profile_id: string | null;
  admin_note: string | null;
  dismissed_at: string | null;
  dismissed_by_profile_id: string | null;
  dismissal_reason: string | null;
  version: number | null;
  created_at: string;
  updated_at: string;
};

type ExactDateRow = {
  submission_id: string;
  covered_on: string;
};

type NameRow = {
  id: string;
  display_name: string;
};

type RequestSetRow = {
  id: string;
  class_subject_id: string;
  coverage_kind: string;
  period_start: string;
  period_end: string;
  requested_by_profile_id: string;
  admin_note: string | null;
  created_at: string;
};

function statusFor(value: string): AdminTeachingUpdateStatus {
  if (value === 'SUBMITTED') return 'SUBMITTED';
  if (value === 'DISMISSED') return 'DISMISSED';
  return 'OPEN';
}

function coverageFor(
  value: string | null
): AdminTeachingUpdateCoverageKind {
  return value === 'DATES' ? 'DATES' : 'RANGE';
}

function untyped(
  db: Awaited<ReturnType<typeof createServerSupabaseClient>>
) {
  return db as unknown as SupabaseClient;
}

export async function listAdminTeachingUpdateContexts(
  schoolId: string
): Promise<AdminTeachingUpdateContext[]> {
  const classes = await listEnrollmentClasses(schoolId);

  return classes
    .filter(({isActive}) => isActive)
    .flatMap((schoolClass) =>
      schoolClass.subjects
        .filter(({isActive}) => isActive)
        .map((subject) => ({
          classId: schoolClass.id,
          classNameEn: schoolClass.nameEn,
          classNameAr: schoolClass.nameAr,
          classSubjectId: subject.id,
          subjectNameEn: subject.nameEn,
          subjectNameAr: subject.nameAr,
          activeGroupCount: subject.groups.filter(
            ({isActive}) => isActive
          ).length
        }))
    )
    .sort((left, right) => {
      const classOrder =
        left.classNameEn.localeCompare(right.classNameEn);

      return classOrder !== 0
        ? classOrder
        : left.subjectNameEn.localeCompare(
            right.subjectNameEn
          );
    });
}

export async function listAdminTeachingUpdates(
  schoolId: string
): Promise<AdminTeachingUpdate[]> {
  const typedDb = await createServerSupabaseClient();
  const db = untyped(typedDb);

  const [classes, submissionResult] = await Promise.all([
    listEnrollmentClasses(schoolId),
    db
      .from('weekly_submissions')
      .select(
        [
          'id',
          'teacher_id',
          'class_subject_id',
          'subject_group_id',
          'request_set_id',
          'coverage_kind',
          'period_start',
          'period_end',
          'week_start',
          'status',
          'progress_en',
          'progress_ar',
          'created_by_profile_id',
          'requested_by_profile_id',
          'admin_note',
          'dismissed_at',
          'dismissed_by_profile_id',
          'dismissal_reason',
          'version',
          'created_at',
          'updated_at'
        ].join(',')
      )
      .eq('school_id', schoolId)
      .order('created_at', {ascending: false})
  ]);

  if (submissionResult.error) {
    throw submissionResult.error;
  }

  const rows =
    (submissionResult.data ?? []) as unknown as SubmissionRow[];

  if (rows.length === 0) return [];

  const submissionIds = rows.map(({id}) => id);

  const teacherIds = [
    ...new Set(
      rows
        .map(({teacher_id}) => teacher_id)
        .filter((value): value is string => Boolean(value))
    )
  ];

  const profileIds = [
    ...new Set(
      rows.flatMap((row) =>
        [
          row.created_by_profile_id,
          row.requested_by_profile_id,
          row.dismissed_by_profile_id
        ].filter((value): value is string => Boolean(value))
      )
    )
  ];

  const [
    exactDateResult,
    teacherResult,
    profileResult
  ] = await Promise.all([
    db
      .from('weekly_submission_dates')
      .select('submission_id,covered_on')
      .in('submission_id', submissionIds)
      .order('covered_on'),

    teacherIds.length > 0
      ? db
          .from('teachers')
          .select('id,display_name')
          .eq('school_id', schoolId)
          .in('id', teacherIds)
      : Promise.resolve({data: [], error: null}),

    profileIds.length > 0
      ? db
          .from('profiles')
          .select('id,display_name')
          .eq('school_id', schoolId)
          .in('id', profileIds)
      : Promise.resolve({data: [], error: null})
  ]);

  if (exactDateResult.error) throw exactDateResult.error;
  if (teacherResult.error) throw teacherResult.error;
  if (profileResult.error) throw profileResult.error;

  const exactDates = new Map<string, string[]>();

  for (
    const row of
      (exactDateResult.data ?? []) as unknown as ExactDateRow[]
  ) {
    const dates = exactDates.get(row.submission_id) ?? [];
    dates.push(row.covered_on);
    exactDates.set(row.submission_id, dates);
  }

  const teacherNames = new Map(
    ((teacherResult.data ?? []) as unknown as NameRow[]).map(
      ({id, display_name}) => [id, display_name]
    )
  );

  const profileNames = new Map(
    ((profileResult.data ?? []) as unknown as NameRow[]).map(
      ({id, display_name}) => [id, display_name]
    )
  );

  const subjectContexts = new Map<
    string,
    {
      classNameEn: string;
      classNameAr: string | null;
      subjectNameEn: string;
      subjectNameAr: string | null;
    }
  >();

  const groupContexts = new Map<
    string,
    {
      nameEn: string;
      nameAr: string | null;
    }
  >();

  for (const schoolClass of classes) {
    for (const subject of schoolClass.subjects) {
      subjectContexts.set(subject.id, {
        classNameEn: schoolClass.nameEn,
        classNameAr: schoolClass.nameAr,
        subjectNameEn: subject.nameEn,
        subjectNameAr: subject.nameAr
      });

      for (const group of subject.groups) {
        groupContexts.set(group.id, {
          nameEn: group.nameEn,
          nameAr: group.nameAr
        });
      }
    }
  }

  return rows.map((row) => {
    const context = subjectContexts.get(row.class_subject_id);
    const group = row.subject_group_id
      ? groupContexts.get(row.subject_group_id)
      : undefined;

    return {
      id: row.id,
      teacherId: row.teacher_id,
      teacherName: row.teacher_id
        ? teacherNames.get(row.teacher_id) ?? null
        : null,
      classSubjectId: row.class_subject_id,
      subjectGroupId: row.subject_group_id,
      classNameEn: context?.classNameEn ?? '',
      classNameAr: context?.classNameAr ?? null,
      subjectNameEn: context?.subjectNameEn ?? '',
      subjectNameAr: context?.subjectNameAr ?? null,
      groupNameEn: group?.nameEn ?? null,
      groupNameAr: group?.nameAr ?? null,
      requestSetId: row.request_set_id,
      source: row.request_set_id
        ? 'ADMIN_REQUEST'
        : 'TEACHER',
      coverageKind: coverageFor(row.coverage_kind),
      periodStart: row.period_start ?? row.week_start,
      periodEnd: row.period_end ?? row.week_start,
      exactDates: exactDates.get(row.id) ?? [],
      status: statusFor(row.status),
      progressEn: row.progress_en,
      progressAr: row.progress_ar,
      createdByProfileId: row.created_by_profile_id,
      createdByName: row.created_by_profile_id
        ? profileNames.get(row.created_by_profile_id) ?? null
        : null,
      requestedByProfileId: row.requested_by_profile_id,
      requestedByName: row.requested_by_profile_id
        ? profileNames.get(row.requested_by_profile_id) ?? null
        : null,
      adminNote: row.admin_note,
      dismissedAt: row.dismissed_at,
      dismissedByProfileId: row.dismissed_by_profile_id,
      dismissedByName: row.dismissed_by_profile_id
        ? profileNames.get(row.dismissed_by_profile_id) ?? null
        : null,
      dismissalReason: row.dismissal_reason,
      version: row.version ?? 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });
}

export async function listAdminTeachingUpdateRequestSets(
  schoolId: string
): Promise<AdminTeachingUpdateRequestSet[]> {
  const typedDb = await createServerSupabaseClient();
  const db = untyped(typedDb);

  const [requestSetResult, updates, contexts] =
    await Promise.all([
      db
        .from('teaching_update_request_sets')
        .select(
          [
            'id',
            'class_subject_id',
            'coverage_kind',
            'period_start',
            'period_end',
            'requested_by_profile_id',
            'admin_note',
            'created_at'
          ].join(',')
        )
        .eq('school_id', schoolId)
        .order('created_at', {ascending: false}),
      listAdminTeachingUpdates(schoolId),
      listAdminTeachingUpdateContexts(schoolId)
    ]);

  if (requestSetResult.error) {
    throw requestSetResult.error;
  }

  const requestSets =
    (requestSetResult.data ?? []) as unknown as RequestSetRow[];

  const contextBySubject = new Map(
    contexts.map((context) => [
      context.classSubjectId,
      context
    ])
  );

  return requestSets.map((requestSet) => {
    // Completion comes from the request_set_id snapshot items that
    // request_teaching_update created at request time. Current Groups
    // are never used to rebuild request-set membership.
    const items = updates.filter(
      ({requestSetId}) => requestSetId === requestSet.id
    );

    const context = contextBySubject.get(
      requestSet.class_subject_id
    );

    const requestedByName =
      items.find(({requestedByName}) => requestedByName)
        ?.requestedByName ?? null;

    return {
      id: requestSet.id,
      classSubjectId: requestSet.class_subject_id,
      classNameEn: context?.classNameEn ?? '',
      classNameAr: context?.classNameAr ?? null,
      subjectNameEn: context?.subjectNameEn ?? '',
      subjectNameAr: context?.subjectNameAr ?? null,
      coverageKind: coverageFor(requestSet.coverage_kind),
      periodStart: requestSet.period_start,
      periodEnd: requestSet.period_end,
      requestedByProfileId:
        requestSet.requested_by_profile_id,
      requestedByName,
      adminNote: requestSet.admin_note,
      createdAt: requestSet.created_at,
      totalCount: items.length,
      submittedCount: items.filter(
        ({status}) => status === 'SUBMITTED'
      ).length,
      openCount: items.filter(
        ({status}) => status === 'OPEN'
      ).length,
      dismissedCount: items.filter(
        ({status}) => status === 'DISMISSED'
      ).length
    };
  });
}
