import 'server-only';

import type {SupabaseClient} from '@supabase/supabase-js';

import {createServerSupabaseClient} from '@/lib/supabase/server';

import {buildReportSnapshotV2} from './report.service';
import {deriveReportAttendance, effectiveReportAttendance} from './report-attendance';
import {getActiveReportTemplate} from './report-template.repository';
import {selectLatestReportRevisionsByStudent} from './select-latest-report-revisions';
import type {ReportLanguage, ReportPerformance} from './report.types';

export type ReportBatchScope = 'CLASS' | 'SUBJECT' | 'GROUP';
export type ReportBatchStatus = 'DRAFT' | 'REVIEW' | 'FINALIZED';

type BatchRow = {
  id: string;
  scope_type: ReportBatchScope;
  class_id: string;
  class_subject_id: string | null;
  subject_group_id: string | null;
  period_start: string;
  period_end: string;
  template_id: string | null;
  status: ReportBatchStatus;
};

type SubmissionRow = {
  id: string;
  class_subject_id: string;
  subject_group_id: string | null;
  teacher_id: string;
  week_start: string;
  coverage_kind: 'RANGE' | 'DATES';
  period_start: string;
  period_end: string;
  progress_en: string | null;
  progress_ar: string | null;
  default_performance: ReportPerformance | null;
};

type ApprovalRow = {
  id: string;
  class_subject_id: string;
  subject_group_id: string | null;
  approved_progress_en: string | null;
  approved_progress_ar: string | null;
  progress_en_approved: boolean;
  progress_ar_approved: boolean;
  performance: ReportPerformance | null;
  comment_en: string | null;
  comment_ar: string | null;
};

type StudentObservationRow = {
  submission_id: string;
  student_id: string;
  attendance_status: 'PRESENT' | 'ABSENT' | null;
  attendance_attended: number | null;
  attendance_total: number | null;
  performance_override: ReportPerformance | null;
  comment_en: string | null;
  comment_ar: string | null;
};

export type ReportBatchSource = {
  id: string;
  classSubjectId: string;
  subjectGroupId: string | null;
  weekStart: string;
  coverageKind: 'RANGE' | 'DATES';
  periodStart: string;
  periodEnd: string;
  coveredDates: string[];
  included: boolean;
  partialOverlap: boolean;
  teacherId: string;
  teacherName: string;
  subjectNameEn: string;
  subjectNameAr: string | null;
  groupNameEn: string | null;
  groupNameAr: string | null;
  progressEn: string | null;
  progressAr: string | null;
  performance: ReportPerformance | null;
  commentEn: string | null;
  commentAr: string | null;
};

export type ReportBatchApproval = {
  id: string;
  classSubjectId: string;
  subjectGroupId: string | null;
  approvedProgressEn: string | null;
  approvedProgressAr: string | null;
  progressEnApproved: boolean;
  progressArApproved: boolean;
  performance: ReportPerformance | null;
  commentEn: string | null;
  commentAr: string | null;
  selectedSourceIds: string[];
};

export type ReportBatchWorkspace = {
  batch: {
    id: string;
    scopeType: ReportBatchScope;
    classId: string;
    classSubjectId: string | null;
    subjectGroupId: string | null;
    periodStart: string;
    periodEnd: string;
    status: ReportBatchStatus;
  };
  school: {nameEn: string; nameAr: string | null; defaultLanguage: ReportLanguage};
  classInfo: {id: string; nameEn: string; nameAr: string | null};
  sources: ReportBatchSource[];
  approvals: ReportBatchApproval[];
  summaryStudents: Array<{
    studentId: string;
    studentNameEn: string;
    studentNameAr: string | null;
    presentCount: number;
    absentCount: number;
    performance: ReportPerformance | null;
    commentEn: string | null;
    commentAr: string | null;
    hasPersonalizedContent: boolean;
    attendanceConflictCount: number;
    missingDataCount: number;
  }>;
};

function contextKey(classSubjectId: string, subjectGroupId: string | null) {
  return `${classSubjectId}:${subjectGroupId ?? 'whole'}`;
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function joinUnique(values: Array<string | null | undefined>) {
  const unique = [...new Set(values.map(clean).filter((value): value is string => value !== null))];
  return unique.length > 0 ? unique.join('\n\n') : null;
}

function appendText(shared: string | null, extra: string | null) {
  if (!extra) return shared;
  return shared ? `${shared}\n\n${extra}` : extra;
}

function periodOverlaps(startsOn: string, endsOn: string | null, start: string, end: string) {
  return startsOn <= end && (!endsOn || endsOn >= start);
}

function requireNoError(error: {message?: string; code?: string} | null) {
  if (error) throw error;
}

export async function createReportBatch(input: {
  schoolId: string;
  createdByProfileId: string;
  scopeType: ReportBatchScope;
  classId: string;
  classSubjectId: string | null;
  subjectGroupId: string | null;
  periodStart: string;
  periodEnd: string;
}) {
  const db = await createServerSupabaseClient();
  const {data, error} = await db.from('report_batches').insert({
    school_id: input.schoolId,
    scope_type: input.scopeType,
    class_id: input.classId,
    class_subject_id: input.scopeType === 'CLASS' ? null : input.classSubjectId,
    subject_group_id: input.scopeType === 'GROUP' ? input.subjectGroupId : null,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    created_by_profile_id: input.createdByProfileId,
    status: 'DRAFT'
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function getReportBatchWorkspace(
  schoolId: string,
  batchId: string
): Promise<ReportBatchWorkspace | null> {
  const db = await createServerSupabaseClient();
  const {data: rawBatch, error: batchError} = await db.from('report_batches')
    .select('id,scope_type,class_id,class_subject_id,subject_group_id,period_start,period_end,template_id,status')
    .eq('school_id', schoolId).eq('id', batchId).maybeSingle();
  if (batchError) throw batchError;
  if (!rawBatch) return null;
  const batch = rawBatch as BatchRow;

  const [schoolResult, classResult, classSubjectsResult] = await Promise.all([
    db.from('schools').select('name_en,name_ar,default_language').eq('id', schoolId).single(),
    db.from('classes').select('id,name_en,name_ar').eq('school_id', schoolId).eq('id', batch.class_id).single(),
    db.from('class_subjects').select('id,subject_id').eq('school_id', schoolId).eq('class_id', batch.class_id).eq('is_active', true)
  ]);
  requireNoError(schoolResult.error);
  requireNoError(classResult.error);
  requireNoError(classSubjectsResult.error);
  if (!schoolResult.data) throw new Error('Report batch school not found');
  if (!classResult.data) throw new Error('Report batch class not found');

  const allClassSubjects = (classSubjectsResult.data ?? []) as Array<{id: string; subject_id: string}>;
  const selectedClassSubjects = allClassSubjects.filter((item) =>
    batch.scope_type === 'CLASS' || item.id === batch.class_subject_id
  );
  const classSubjectIds = selectedClassSubjects.map(({id}) => id);
  const subjectIds = selectedClassSubjects.map(({subject_id}) => subject_id);

  const subjectsResult = subjectIds.length > 0
    ? await db.from('subjects').select('id,name_en,name_ar').eq('school_id', schoolId).in('id', subjectIds)
    : {data: [], error: null};
  const groupsResult = classSubjectIds.length > 0
    ? await db.from('subject_groups').select('id,class_subject_id,name_en,name_ar').eq('school_id', schoolId).in('class_subject_id', classSubjectIds)
    : {data: [], error: null};
  requireNoError(subjectsResult.error);
  requireNoError(groupsResult.error);

  const coveredDatesBySubmission = new Map<string, string[]>();
  let submissions: SubmissionRow[] = [];

  if (classSubjectIds.length > 0) {
    const submissionResult = await db
      .from('weekly_submissions')
      .select(
        'id,class_subject_id,subject_group_id,teacher_id,week_start,coverage_kind,period_start,period_end,progress_en,progress_ar,default_performance'
      )
      .eq('school_id', schoolId)
      .eq('status', 'SUBMITTED')
      .lte('period_start', batch.period_end)
      .gte('period_end', batch.period_start)
      .in('class_subject_id', classSubjectIds)
      .order('period_start');

    if (submissionResult.error) throw submissionResult.error;

    const candidates =
      (submissionResult.data ?? []) as SubmissionRow[];

    const exactDateIds = candidates
      .filter(({coverage_kind}) => coverage_kind === 'DATES')
      .map(({id}) => id);

    if (exactDateIds.length > 0) {
      const exactDateResult = await db
        .from('weekly_submission_dates')
        .select('submission_id,covered_on')
        .eq('school_id', schoolId)
        .in('submission_id', exactDateIds)
        .order('covered_on');

      if (exactDateResult.error) throw exactDateResult.error;

      for (const row of exactDateResult.data ?? []) {
        const dates =
          coveredDatesBySubmission.get(row.submission_id) ?? [];

        dates.push(row.covered_on);
        coveredDatesBySubmission.set(row.submission_id, dates);
      }
    }

    submissions = candidates.filter((submission) => {
      if (submission.coverage_kind === 'RANGE') return true;

      return (
        coveredDatesBySubmission.get(submission.id) ?? []
      ).some(
        (coveredOn) =>
          coveredOn >= batch.period_start &&
          coveredOn <= batch.period_end
      );
    });

    if (batch.scope_type === 'GROUP') {
      submissions = submissions.filter(
        ({subject_group_id}) =>
          subject_group_id === batch.subject_group_id
      );
    }
  }

  const teacherIds = [...new Set(submissions.map(({teacher_id}) => teacher_id))];
  const teachersResult = teacherIds.length > 0
    ? await db.from('teachers').select('id,display_name').eq('school_id', schoolId).in('id', teacherIds)
    : {data: [], error: null};
  requireNoError(teachersResult.error);

  const approvalResult = await db.from('report_section_approvals')
    .select('id,class_subject_id,subject_group_id,approved_progress_en,approved_progress_ar,progress_en_approved,progress_ar_approved,performance,comment_en,comment_ar')
    .eq('school_id', schoolId).eq('batch_id', batch.id);
  if (approvalResult.error) throw approvalResult.error;
  const approvalRows = (approvalResult.data ?? []) as ApprovalRow[];
  const approvalIds = approvalRows.map(({id}) => id);
  const linksResult = approvalIds.length > 0
    ? await db
        .from('report_section_sources')
        .select('approval_id,weekly_submission_id,included')
        .eq('school_id', schoolId)
        .in('approval_id', approvalIds)
    : {data: [], error: null};
  requireNoError(linksResult.error);

  const studentResult = await db.from('students')
    .select('id,first_name_en,last_name_en,first_name_ar,last_name_ar')
    .eq('school_id', schoolId)
    .eq('is_active', true);
  if (studentResult.error) throw studentResult.error;
  const enrollmentResult = await db.from('class_enrollments')
    .select('student_id,starts_on,ends_on').eq('school_id', schoolId).eq('class_id', batch.class_id);
  if (enrollmentResult.error) throw enrollmentResult.error;
  const activeStudentIds = new Set(
    (studentResult.data ?? []).map(({id}) => id)
  );

  const enrolledStudentIds = [...new Set(
    (enrollmentResult.data ?? [])
      .filter(
        (row) =>
          activeStudentIds.has(row.student_id) &&
          periodOverlaps(
            row.starts_on,
            row.ends_on,
            batch.period_start,
            batch.period_end
          )
      )
      .map(({student_id}) => student_id)
  )];

  const groupMembershipResult =
    batch.scope_type === 'GROUP' && batch.subject_group_id
      ? await db
          .from('subject_group_memberships')
          .select('student_id,starts_on,ends_on')
          .eq('school_id', schoolId)
          .eq('class_subject_id', batch.class_subject_id!)
          .eq('subject_group_id', batch.subject_group_id)
      : {data: [], error: null};

  requireNoError(groupMembershipResult.error);

  const scopedStudentIds =
    batch.scope_type === 'GROUP'
      ? enrolledStudentIds.filter((studentId) =>
          (groupMembershipResult.data ?? []).some(
            (membership) =>
              membership.student_id === studentId &&
              periodOverlaps(
                membership.starts_on,
                membership.ends_on,
                batch.period_start,
                batch.period_end
              )
          )
        )
      : enrolledStudentIds;

  const submissionIds = submissions.map(({id}) => id);

  const observationResult =
    submissionIds.length > 0
      ? await db
          .from('weekly_submission_students')
          .select(
            'submission_id,student_id,attendance_status,attendance_attended,attendance_total,performance_override,comment_en,comment_ar'
          )
          .eq('school_id', schoolId)
          .in('submission_id', submissionIds)
      : {data: [], error: null};

  requireNoError(observationResult.error);

  const observations =
    (observationResult.data ?? []) as StudentObservationRow[];

  const overrideResult = approvalIds.length > 0
    ? await db.from('report_student_overrides').select('student_id').eq('school_id', schoolId).in('approval_id', approvalIds)
    : {data: [], error: null};
  requireNoError(overrideResult.error);
  const personalizedIds = new Set((overrideResult.data ?? []).map(({student_id}) => student_id));

  const subjectById = new Map((subjectsResult.data ?? []).map((row) => [row.id, row]));
  const subjectIdByClassSubject = new Map(selectedClassSubjects.map((row) => [row.id, row.subject_id]));
  const groupById = new Map((groupsResult.data ?? []).map((row) => [row.id, row]));
  const teacherById = new Map((teachersResult.data ?? []).map((row) => [row.id, row.display_name]));
  const studentById = new Map(
    (studentResult.data ?? []).map((row) => [row.id, row])
  );
  const submissionById = new Map(
    submissions.map((row) => [row.id, row])
  );
  const sourceLinks = (linksResult.data ?? []) as Array<{
    approval_id: string;
    weekly_submission_id: string;
    included: boolean;
  }>;

  const sources: ReportBatchSource[] = submissions.map((row) => {
    const subject = subjectById.get(
      subjectIdByClassSubject.get(row.class_subject_id) ?? ''
    );

    const group = row.subject_group_id
      ? groupById.get(row.subject_group_id)
      : null;

    const coveredDates =
      coveredDatesBySubmission.get(row.id) ?? [];

    const sourceLink = sourceLinks.find(
      ({weekly_submission_id}) =>
        weekly_submission_id === row.id
    );

    const partialOverlap =
      row.coverage_kind === 'DATES'
        ? coveredDates.some(
            (coveredOn) =>
              coveredOn < batch.period_start ||
              coveredOn > batch.period_end
          )
        : row.period_start < batch.period_start ||
          row.period_end > batch.period_end;

    return {
      id: row.id,
      classSubjectId: row.class_subject_id,
      subjectGroupId: row.subject_group_id,
      weekStart: row.week_start,
      coverageKind: row.coverage_kind,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      coveredDates,
      included: sourceLink?.included ?? true,
      partialOverlap,
      teacherId: row.teacher_id,
      teacherName:
        teacherById.get(row.teacher_id) ?? 'Teacher',
      subjectNameEn:
        subject?.name_en ?? row.class_subject_id,
      subjectNameAr: subject?.name_ar ?? null,
      groupNameEn: group?.name_en ?? null,
      groupNameAr: group?.name_ar ?? null,
      progressEn: row.progress_en,
      progressAr: row.progress_ar,
      performance: row.default_performance,
      commentEn: null,
      commentAr: null
    };
  });

  const approvals: ReportBatchApproval[] = approvalRows.map((row) => ({
    id: row.id,
    classSubjectId: row.class_subject_id,
    subjectGroupId: row.subject_group_id,
    approvedProgressEn: row.approved_progress_en,
    approvedProgressAr: row.approved_progress_ar,
    progressEnApproved: row.progress_en_approved,
    progressArApproved: row.progress_ar_approved,
    performance: row.performance,
    commentEn: row.comment_en,
    commentAr: row.comment_ar,
    selectedSourceIds: sourceLinks
      .filter(
        ({approval_id, included}) =>
          approval_id === row.id && included
      )
      .map(
        ({weekly_submission_id}) => weekly_submission_id
      )
  }));

  const expectedContexts = new Set(
    sources
      .filter(({included}) => included)
      .map((source) =>
        contextKey(
          source.classSubjectId,
          source.subjectGroupId
        )
      )
  ).size;

  const approvedContexts = new Set(
    approvals
      .filter(({selectedSourceIds}) => selectedSourceIds.length > 0)
      .map((approval) =>
        contextKey(
          approval.classSubjectId,
          approval.subjectGroupId
        )
      )
  ).size;

  const summaryStudents = scopedStudentIds
    .map((studentId) => {
      const student = studentById.get(studentId);
      const studentObservations = observations.filter(
        (observation) => observation.student_id === studentId
      );

      const weekStatuses = new Map<string, Set<string>>();

      for (const observation of studentObservations) {
        const week =
          submissionById.get(observation.submission_id)?.week_start ?? '';

        const statuses = weekStatuses.get(week) ?? new Set<string>();
        if (observation.attendance_status) statuses.add(observation.attendance_status);
        weekStatuses.set(week, statuses);
      }

      const attendanceConflictCount = [...weekStatuses.values()].filter(
        (statuses) => statuses.size > 1
      ).length;

      const orderedObservations = [...studentObservations].sort(
        (left, right) => {
          const leftWeek =
            submissionById.get(left.submission_id)?.week_start ?? '';
          const rightWeek =
            submissionById.get(right.submission_id)?.week_start ?? '';

          return leftWeek.localeCompare(rightWeek);
        }
      );

      const latestObservation = orderedObservations.at(-1);
      const latestSubmission = latestObservation
        ? submissionById.get(latestObservation.submission_id)
        : null;

      const commentEn = joinUnique(
        studentObservations.map(({comment_en}) => comment_en)
      );

      const commentAr = joinUnique(
        studentObservations.map(({comment_ar}) => comment_ar)
      );

      const hasTeacherPersonalization = studentObservations.some(
        (observation) =>
          observation.performance_override !== null ||
          clean(observation.comment_en) !== null ||
          clean(observation.comment_ar) !== null
      );

      return {
        studentId,
        studentNameEn: student
          ? `${student.first_name_en} ${student.last_name_en}`
          : studentId,
        studentNameAr:
          student?.first_name_ar && student?.last_name_ar
            ? `${student.first_name_ar} ${student.last_name_ar}`
            : null,
        presentCount: studentObservations.reduce(
          (sum, row) => sum + (row.attendance_attended ??
            (row.attendance_status === 'PRESENT' ? 1 : 0)), 0
        ),
        absentCount: studentObservations.reduce(
          (sum, row) => sum + (row.attendance_total !== null &&
          row.attendance_attended !== null
            ? row.attendance_total - row.attendance_attended
            : row.attendance_status === 'ABSENT' ? 1 : 0), 0
        ),
        performance:
          latestObservation?.performance_override ??
          latestSubmission?.default_performance ??
          null,
        commentEn,
        commentAr,
        hasPersonalizedContent:
          personalizedIds.has(studentId) || hasTeacherPersonalization,
        attendanceConflictCount,
        missingDataCount:
          expectedContexts > 0 &&
          approvedContexts === expectedContexts &&
          studentObservations.length > 0
            ? 0
            : 1
      };
    })
    .sort((left, right) =>
      left.studentNameEn.localeCompare(right.studentNameEn)
    );

  return {
    batch: {
      id: batch.id,
      scopeType: batch.scope_type,
      classId: batch.class_id,
      classSubjectId: batch.class_subject_id,
      subjectGroupId: batch.subject_group_id,
      periodStart: batch.period_start,
      periodEnd: batch.period_end,
      status: batch.status
    },
    school: {
      nameEn: schoolResult.data.name_en,
      nameAr: schoolResult.data.name_ar,
      defaultLanguage: schoolResult.data.default_language as ReportLanguage
    },
    classInfo: {
      id: classResult.data.id,
      nameEn: classResult.data.name_en,
      nameAr: classResult.data.name_ar
    },
    sources,
    approvals,
    summaryStudents
  };
}

export async function approveAllSubmittedSources(schoolId: string, batchId: string) {
  const workspace = await getReportBatchWorkspace(schoolId, batchId);
  if (!workspace) throw new Error('Report batch not found');
  if (workspace.batch.status === 'FINALIZED') {
    throw new Error('Finalized report batches cannot be changed');
  }
  const includedSources = workspace.sources.filter(
    ({included}) => included
  );

  if (includedSources.length === 0) {
    throw new Error(
      'No included Teaching Updates are available for this batch'
    );
  }

  const db = await createServerSupabaseClient();
  const grouped = new Map<string, ReportBatchSource[]>();

  for (const source of includedSources) {
    const key = contextKey(source.classSubjectId, source.subjectGroupId);
    grouped.set(key, [...(grouped.get(key) ?? []), source]);
  }

  for (const sources of grouped.values()) {
    const first = sources[0]!;
    const payload = {
      approved_progress_en: joinUnique(sources.map(({progressEn}) => progressEn)),
      approved_progress_ar: joinUnique(sources.map(({progressAr}) => progressAr)),
      performance: sources.map(({performance}) => performance).filter((value): value is ReportPerformance => value !== null).at(-1) ?? null,
      comment_en: joinUnique(sources.map(({commentEn}) => commentEn)),
      comment_ar: joinUnique(sources.map(({commentAr}) => commentAr))
    };

    let existingQuery = db.from('report_section_approvals').select('id')
      .eq('school_id', schoolId).eq('batch_id', batchId).eq('class_subject_id', first.classSubjectId);
    existingQuery = first.subjectGroupId === null
      ? existingQuery.is('subject_group_id', null)
      : existingQuery.eq('subject_group_id', first.subjectGroupId);
    const {data: existing, error: existingError} = await existingQuery.maybeSingle();
    if (existingError) throw existingError;

    let approvalId: string;
    if (existing) {
      const {data: approvedFlags, error: approvedFlagsError} = await db
        .from('report_section_approvals')
        .select('progress_en_approved,progress_ar_approved')
        .eq('school_id', schoolId)
        .eq('id', existing.id)
        .single();
      if (approvedFlagsError) throw approvedFlagsError;
      const safePayload = {
        performance: payload.performance,
        comment_en: payload.comment_en,
        comment_ar: payload.comment_ar,
        ...(approvedFlags.progress_en_approved ? {} : {
          approved_progress_en: payload.approved_progress_en
        }),
        ...(approvedFlags.progress_ar_approved ? {} : {
          approved_progress_ar: payload.approved_progress_ar
        })
      };
      const {error} = await db.from('report_section_approvals')
        .update(safePayload)
        .eq('school_id', schoolId).eq('id', existing.id);
      if (error) throw error;
      approvalId = existing.id;
    } else {
      const {data, error} = await db.from('report_section_approvals').insert({
        school_id: schoolId,
        batch_id: batchId,
        class_subject_id: first.classSubjectId,
        subject_group_id: first.subjectGroupId,
        ...payload
      }).select('id').single();
      if (error) throw error;
      approvalId = data.id as string;
    }

    const links = sources.map((source) => ({
      school_id: schoolId,
      approval_id: approvalId,
      weekly_submission_id: source.id
    }));
    const {error: linkError} = await db.from('report_section_sources')
      .upsert(links, {onConflict: 'school_id,approval_id,weekly_submission_id', ignoreDuplicates: true});
    if (linkError) throw linkError;
  }
}

export async function reviewReportBatch(schoolId: string, batchId: string) {
  const workspace = await getReportBatchWorkspace(schoolId, batchId);
  if (!workspace) throw new Error('Report batch not found');
  if (workspace.batch.status !== 'DRAFT') throw new Error('Only draft report batches can move to review');
  const expected = new Set(
    workspace.sources
      .filter(({included}) => included)
      .map((source) =>
        contextKey(
          source.classSubjectId,
          source.subjectGroupId
        )
      )
  );

  const approved = new Set(
    workspace.approvals
      .filter(
        ({selectedSourceIds}) => selectedSourceIds.length > 0
      )
      .map((item) =>
        contextKey(
          item.classSubjectId,
          item.subjectGroupId
        )
      )
  );
  if (expected.size === 0 || [...expected].some((key) => !approved.has(key))) {
    throw new Error('Approve submitted sources before moving the report batch to review');
  }

  const db = await createServerSupabaseClient();
  const {error} = await db.from('report_batches').update({status: 'REVIEW'})
    .eq('school_id', schoolId).eq('id', batchId).eq('status', 'DRAFT');
  if (error) throw error;
}

type SubmissionStudentRow = {
  submission_id: string;
  student_id: string;
  attendance_status: 'PRESENT' | 'ABSENT' | null;
  attendance_attended: number | null;
  attendance_total: number | null;
  performance_override: ReportPerformance | null;
  comment_en: string | null;
  comment_ar: string | null;
};

type ResolutionRow = {
  class_subject_id: string;
  subject_group_id: string | null;
  week_start: string;
  student_id: string;
  resolved_status: 'PRESENT' | 'ABSENT';
};

export async function finalizeReportBatch(schoolId: string, batchId: string) {
  const workspace = await getReportBatchWorkspace(schoolId, batchId);
  if (!workspace) throw new Error('Report batch not found');
  if (workspace.batch.status === 'FINALIZED') {
    throw new Error('Report batch is already finalized');
  }

  if (
    workspace.approvals.every(
      ({selectedSourceIds}) => selectedSourceIds.length === 0
    )
  ) {
    throw new Error('Report batch has no included approved sections');
  }

  const expectedContexts = new Set(
    workspace.sources
      .filter(({included}) => included)
      .map((source) =>
        contextKey(
          source.classSubjectId,
          source.subjectGroupId
        )
      )
  );

  const approvedContexts = new Set(
    workspace.approvals
      .filter(
        ({selectedSourceIds}) => selectedSourceIds.length > 0
      )
      .map((approval) =>
        contextKey(
          approval.classSubjectId,
          approval.subjectGroupId
        )
      )
  );

  if (
    expectedContexts.size === 0 ||
    [...expectedContexts].some(
      (key) => !approvedContexts.has(key)
    )
  ) {
    throw new Error(
      'Approve submitted sources before finalizing reports'
    );
  }

  const db = await createServerSupabaseClient();
  const template = await getActiveReportTemplate(schoolId);
  const sourceIds = workspace.sources
    .filter(({included}) => included)
    .map(({id}) => id);
  const approvalIds = workspace.approvals.map(({id}) => id);
  const classSubjectIds = [...new Set(workspace.approvals.map(({classSubjectId}) => classSubjectId))];

  const [studentsResult, enrollmentsResult, exclusionsResult, membershipsResult, observationResult, resolutionResult, guardianLinkResult, guardianResult, overrideResult] = await Promise.all([
    db.from('students').select('id,first_name_en,last_name_en,first_name_ar,last_name_ar').eq('school_id', schoolId).eq('is_active', true),
    db.from('class_enrollments').select('student_id,starts_on,ends_on').eq('school_id', schoolId).eq('class_id', workspace.batch.classId),
    db.from('subject_exclusions').select('student_id,class_subject_id,starts_on,ends_on').eq('school_id', schoolId).in('class_subject_id', classSubjectIds),
    db.from('subject_group_memberships').select('student_id,class_subject_id,subject_group_id,starts_on,ends_on').eq('school_id', schoolId).in('class_subject_id', classSubjectIds),
    db.from('weekly_submission_students').select('submission_id,student_id,attendance_status,attendance_attended,attendance_total,performance_override,comment_en,comment_ar').eq('school_id', schoolId).in('submission_id', sourceIds),
    db.from('attendance_resolutions').select('class_subject_id,subject_group_id,week_start,student_id,resolved_status').eq('school_id', schoolId).gte('week_start', workspace.batch.periodStart).lte('week_start', workspace.batch.periodEnd).in('class_subject_id', classSubjectIds),
    db.from('student_guardians').select('student_id,guardian_id,receives_reports').eq('school_id', schoolId),
    db.from('guardians').select('id,report_language,is_active').eq('school_id', schoolId),
    db.from('report_student_overrides') .select('approval_id,student_id,progress_en,progress_ar,performance,performance_overridden,comment_en,comment_ar,attendance_attended,attendance_total').eq('school_id', schoolId).in('approval_id', approvalIds)
  ]);
  for (const result of [studentsResult, enrollmentsResult, exclusionsResult, membershipsResult, observationResult, resolutionResult, guardianLinkResult, guardianResult, overrideResult]) {
    requireNoError(result.error);
  }

  const students = studentsResult.data ?? [];
  const enrollments = enrollmentsResult.data ?? [];
  const exclusions = exclusionsResult.data ?? [];
  const memberships = membershipsResult.data ?? [];
  const observations = (observationResult.data ?? []) as SubmissionStudentRow[];
  const resolutions = (resolutionResult.data ?? []) as ResolutionRow[];
  const guardianLinks = guardianLinkResult.data ?? [];
  const guardians = new Map((guardianResult.data ?? []).map((row) => [row.id, row]));
  const overrides = overrideResult.data ?? [];
  const enrolledIds = new Set(enrollments
    .filter((row) => periodOverlaps(row.starts_on, row.ends_on, workspace.batch.periodStart, workspace.batch.periodEnd))
    .map(({student_id}) => student_id));
  const generatedAt = new Date().toISOString();
  const reports: Array<{student_id: string; language: ReportLanguage; snapshot_json: unknown}> = [];

  for (const student of students) {
    if (!enrolledIds.has(student.id)) continue;
    const sections = [];

    for (const approval of workspace.approvals) {
      const excluded = exclusions.some((row) =>
        row.student_id === student.id && row.class_subject_id === approval.classSubjectId &&
        periodOverlaps(row.starts_on, row.ends_on, workspace.batch.periodStart, workspace.batch.periodEnd)
      );
      if (excluded) continue;
      if (approval.subjectGroupId !== null) {
        const inGroup = memberships.some((row) =>
          row.student_id === student.id && row.class_subject_id === approval.classSubjectId &&
          row.subject_group_id === approval.subjectGroupId &&
          periodOverlaps(row.starts_on, row.ends_on, workspace.batch.periodStart, workspace.batch.periodEnd)
        );
        if (!inGroup) continue;
      }

      const selectedSources = workspace.sources.filter((source) => approval.selectedSourceIds.includes(source.id));
      if (selectedSources.length === 0) continue;
      const selectedIds = new Set(selectedSources.map(({id}) => id));
      const studentObservations = observations.filter((row) => row.student_id === student.id && selectedIds.has(row.submission_id));
      const derivedAttendance = deriveReportAttendance({
        sources: selectedSources.map((source) => ({
          id: source.id,
          weekStart: source.weekStart,
          coverageKind: source.coverageKind,
          periodStart: source.periodStart,
          periodEnd: source.periodEnd,
          coveredDates: source.coveredDates,
          partialOverlap: source.partialOverlap
        })),
        observations: studentObservations.map((row) => ({
          submissionId: row.submission_id,
          studentId: row.student_id,
          attendanceStatus: row.attendance_status,
          attended: row.attendance_attended,
          total: row.attendance_total
        })),
        resolutions: resolutions.map((row) => ({
          classSubjectId: row.class_subject_id,
          subjectGroupId: row.subject_group_id,
          weekStart: row.week_start,
          studentId: row.student_id,
          resolvedStatus: row.resolved_status
        })),
        classSubjectId: approval.classSubjectId,
        subjectGroupId: approval.subjectGroupId,
        studentId: student.id
      });

      const explicitOverride = overrides.find((row) => row.approval_id === approval.id && row.student_id === student.id);
      const attendance = effectiveReportAttendance(
        derivedAttendance,
        explicitOverride?.attendance_attended,
        explicitOverride?.attendance_total
      );
      const sourcePerformance = studentObservations
        .map(({performance_override}) => performance_override)
        .filter((value): value is ReportPerformance => value !== null)
        .at(-1) ?? null;
      const sourceCommentEn = joinUnique(studentObservations.map(({comment_en}) => comment_en));
      const sourceCommentAr = joinUnique(studentObservations.map(({comment_ar}) => comment_ar));
      const source = selectedSources[0]!;

      sections.push({
        classSubjectId: approval.classSubjectId,
        subjectNameEn: source.subjectNameEn,
        subjectNameAr: source.subjectNameAr,
        groupNameEn: source.groupNameEn,
        groupNameAr: source.groupNameAr,
        approvedProgressEn: clean(explicitOverride?.progress_en) ??
          (approval.progressEnApproved ? approval.approvedProgressEn :
            approval.approvedProgressEn ?? joinUnique(selectedSources.map(({progressEn}) => progressEn))),
        approvedProgressAr: clean(explicitOverride?.progress_ar) ??
          (approval.progressArApproved ? approval.approvedProgressAr :
            approval.approvedProgressAr ?? joinUnique(selectedSources.map(({progressAr}) => progressAr))),
        performance: explicitOverride?.performance_overridden
          ? (explicitOverride.performance as ReportPerformance | null)
          : sourcePerformance ?? approval.performance,
        attendance: {
          present: attendance.attended,
          absent: attendance.total - attendance.attended,
          sessions: attendance.total
        },
        commentEn: appendText(approval.commentEn, clean(explicitOverride?.comment_en) ?? sourceCommentEn),
        commentAr: appendText(approval.commentAr, clean(explicitOverride?.comment_ar) ?? sourceCommentAr),
        sourceTeacherNames: selectedSources.map(({teacherName}) => teacherName),
        unresolvedAttendanceConflicts: attendance.unresolvedConflicts
      });
    }

    if (sections.length === 0) continue;
    const linkedGuardianIds = guardianLinks
      .filter((row) => row.student_id === student.id && row.receives_reports)
      .map(({guardian_id}) => guardian_id);
    const languages = [...new Set<ReportLanguage>(linkedGuardianIds.flatMap((id) => {
      const guardian = guardians.get(id);
      return guardian?.is_active ? [guardian.report_language as ReportLanguage] : [];
    }))];
    if (languages.length === 0) languages.push(workspace.school.defaultLanguage);

    for (const language of languages) {
      const built = buildReportSnapshotV2({
        school: {nameEn: workspace.school.nameEn, nameAr: workspace.school.nameAr ?? workspace.school.nameEn},
        student: {
          id: student.id,
          nameEn: `${student.first_name_en} ${student.last_name_en}`,
          nameAr: student.first_name_ar && student.last_name_ar ? `${student.first_name_ar} ${student.last_name_ar}` : null
        },
        class: workspace.classInfo,
        period: {start: workspace.batch.periodStart, end: workspace.batch.periodEnd},
        language,
        sections,
        template: {
          name: template.name,
          mainReportLabelEn: template.mainReportLabelEn,
          mainReportLabelAr: template.mainReportLabelAr,
          mainReportHelpEn: template.mainReportHelpEn,
          mainReportHelpAr: template.mainReportHelpAr,
          performanceEnabled: template.performanceEnabled,
          performanceLabelEn: template.performanceLabelEn,
          performanceLabelAr: template.performanceLabelAr,
          studentCommentsEnabled: template.studentCommentsEnabled,
          studentCommentLabelEn: template.studentCommentLabelEn,
          studentCommentLabelAr: template.studentCommentLabelAr,
          studentCommentHelpEn: template.studentCommentHelpEn,
          studentCommentHelpAr: template.studentCommentHelpAr,
          introEn: template.introEn,
          introAr: template.introAr,
          closingEn: template.closingEn,
          closingAr: template.closingAr,
          emailSubjectEn: template.emailSubjectEn,
          emailSubjectAr: template.emailSubjectAr,
          emailGreetingEn: template.emailGreetingEn,
          emailGreetingAr: template.emailGreetingAr,
          emailMessageEn: template.emailMessageEn,
          emailMessageAr: template.emailMessageAr,
          emailClosingEn: template.emailClosingEn,
          emailClosingAr: template.emailClosingAr,
          emailSignoffEn: template.emailSignoffEn,
          emailSignoffAr: template.emailSignoffAr
        },
        generatedAt
      });
      if (!built.snapshot || built.issues.length > 0) {
        throw new Error('Unresolved attendance conflicts block report finalization');
      }
      reports.push({student_id: student.id, language, snapshot_json: built.snapshot});
    }
  }

  if (reports.length === 0) throw new Error('No student reports are ready to finalize');
  const {data, error} = await db.rpc('finalize_report_batch', {
    p_batch_id: batchId,
    p_reports: reports
  });
  if (error) throw error;
  return data as number;
}


export type ClassReportCycleListItem = {
  id: string;
  classId: string;
  classNameEn: string;
  classNameAr: string | null;
  periodStart: string;
  periodEnd: string;
  status: ReportBatchStatus;
  createdAt: string;
  canDismiss: boolean;
};

export type ClassReportCycleMissingContext = {
  classSubjectId: string;
  subjectGroupId: string | null;
  subjectNameEn: string;
  subjectNameAr: string | null;
  groupNameEn: string | null;
  groupNameAr: string | null;
};

export type ClassReportCycleWorkspace =
  ReportBatchWorkspace & {
    missingContexts: ClassReportCycleMissingContext[];
    canDismiss: boolean;
    reports: Array<{
      id: string;
      studentId: string;
      studentNameEn: string;
      studentNameAr: string | null;
      language: ReportLanguage;
      status: 'DRAFT' | 'READY' | 'SENT' | 'FAILED';
    }>;
  };

export async function createClassReportCycle(
  classId: string,
  periodStart: string,
  periodEnd: string,
  templateId: string | null
) {
  const db =
    (await createServerSupabaseClient()) as unknown as SupabaseClient;

  const {data, error} = await db.rpc(
    'create_class_report_cycle',
    {
      p_class_id: classId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_template_id: templateId
    }
  );

  if (error) throw error;
  return data as string;
}

export async function deleteClassReportCycle(
  schoolId: string,
  batchId: string
) {
  const db = await createServerSupabaseClient();

  const {data: batch, error: lookupError} = await db
    .from('report_batches')
    .select('id,status,scope_type')
    .eq('school_id', schoolId)
    .eq('id', batchId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!batch || batch.scope_type !== 'CLASS') {
    throw new Error('Report Cycle not found');
  }
  // The database RPC atomically rechecks that the cycle is unsent,
  // has no delivery history, and has no later report revisions.
  const {error} = await db.rpc(
    'cancel_class_report_cycle',
    {
      p_batch_id: batchId
    }
  );

  if (error) throw error;
}

/**
 * Keep the UI in sync with the atomic server-side dismissal restrictions.
 * A newer report revision or any delivery history makes a cycle immutable.
 */
async function getDismissibleClassReportBatchIds(
  schoolId: string,
  batchIds: string[]
): Promise<Set<string>> {
  if (batchIds.length === 0) return new Set();

  const db = await createServerSupabaseClient();
  const {data: reports, error} = await db
    .from('reports')
    .select('id,batch_id,status,email_deliveries(id)')
    .eq('school_id', schoolId)
    .in('batch_id', batchIds);
  if (error) throw error;

  const reportIds = (reports ?? []).map(({id}) => id);
  const {data: successors, error: successorError} = reportIds.length > 0
    ? await db.from('reports')
        .select('batch_id,supersedes_report_id')
        .eq('school_id', schoolId)
        .in('supersedes_report_id', reportIds)
    : {data: [], error: null};
  if (successorError) throw successorError;

  const ownBatch = new Map((reports ?? []).map(
    ({id, batch_id}) => [id, batch_id]
  ));
  const blocked = new Set<string>();
  for (const report of reports ?? []) {
    if (
      !['DRAFT', 'READY'].includes(report.status) ||
      (report.email_deliveries ?? []).length > 0
    ) {
      blocked.add(report.batch_id);
    }
  }
  for (const newer of successors ?? []) {
    const originalBatchId = ownBatch.get(newer.supersedes_report_id);
    if (originalBatchId && newer.batch_id !== originalBatchId) {
      blocked.add(originalBatchId);
    }
  }

  return new Set(batchIds.filter((id) => !blocked.has(id)));
}

export async function listClassReportCycles(
  schoolId: string
): Promise<ClassReportCycleListItem[]> {
  const db = await createServerSupabaseClient();

  const {data: batches, error: batchError} = await db
    .from('report_batches')
    .select(
      'id,class_id,period_start,period_end,status,created_at'
    )
    .eq('school_id', schoolId)
    .eq('scope_type', 'CLASS')
    .order('created_at', {ascending: false});

  if (batchError) throw batchError;

  const classIds = [
    ...new Set((batches ?? []).map(({class_id}) => class_id))
  ];

  const [classResult, dismissibleIds] = await Promise.all([
    classIds.length > 0
      ? db.from('classes')
          .select('id,name_en,name_ar')
          .eq('school_id', schoolId)
          .in('id', classIds)
      : Promise.resolve({data: [], error: null}),
    getDismissibleClassReportBatchIds(
      schoolId,
      (batches ?? []).map(({id}) => id)
    )
  ]);

  if (classResult.error) throw classResult.error;

  const classes = new Map(
    (classResult.data ?? []).map((row) => [row.id, row])
  );

  return (batches ?? []).map((row) => {
    const classInfo = classes.get(row.class_id);

    return {
      id: row.id,
      classId: row.class_id,
      classNameEn: classInfo?.name_en ?? row.class_id,
      classNameAr: classInfo?.name_ar ?? null,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status as ReportBatchStatus,
      createdAt: row.created_at,
      canDismiss: dismissibleIds.has(row.id)
    };
  });
}

export async function getClassReportCycleWorkspace(
  batchId: string
): Promise<ClassReportCycleWorkspace | null> {
  const db = await createServerSupabaseClient();

  const {data: batch, error: batchError} = await db
    .from('report_batches')
    .select('school_id,scope_type')
    .eq('id', batchId)
    .maybeSingle();

  if (batchError) throw batchError;

  if (!batch || batch.scope_type !== 'CLASS') {
    return null;
  }

  const schoolId = batch.school_id;
  const workspace =
    await getReportBatchWorkspace(schoolId, batchId);

  if (!workspace) return null;

  const [
    classSubjectsResult,
    reportsResult,
    dismissibleIds
  ] = await Promise.all([
    db
      .from('class_subjects')
      .select('id,subject_id')
      .eq('school_id', schoolId)
      .eq('class_id', workspace.batch.classId)
      .eq('is_active', true),
    db
      .from('reports')
      .select(
        'id,student_id,language,status,revision,students(first_name_en,last_name_en,first_name_ar,last_name_ar)'
      )
      .eq('school_id', schoolId)
      .eq('batch_id', batchId)
      .order('generated_at'),
    getDismissibleClassReportBatchIds(schoolId, [batchId])
  ]);

  if (classSubjectsResult.error) {
    throw classSubjectsResult.error;
  }

  if (reportsResult.error) throw reportsResult.error;

  const classSubjects =
    classSubjectsResult.data ?? [];

  const subjectIds = [
    ...new Set(classSubjects.map(({subject_id}) => subject_id))
  ];

  const classSubjectIds =
    classSubjects.map(({id}) => id);

  const [subjectsResult, groupsResult] = await Promise.all([
    subjectIds.length > 0
      ? db
          .from('subjects')
          .select('id,name_en,name_ar')
          .eq('school_id', schoolId)
          .in('id', subjectIds)
      : Promise.resolve({data: [], error: null}),
    classSubjectIds.length > 0
      ? db
          .from('subject_groups')
          .select('id,class_subject_id,name_en,name_ar,is_active')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .in('class_subject_id', classSubjectIds)
      : Promise.resolve({data: [], error: null})
  ]);

  if (subjectsResult.error) throw subjectsResult.error;
  if (groupsResult.error) throw groupsResult.error;

  const subjectById = new Map(
    (subjectsResult.data ?? []).map((row) => [row.id, row])
  );

  const groupsByClassSubject =
    new Map<string, Array<{
      id: string;
      name_en: string;
      name_ar: string | null;
    }>>();

  for (const group of groupsResult.data ?? []) {
    const list =
      groupsByClassSubject.get(group.class_subject_id) ?? [];

    list.push(group);
    groupsByClassSubject.set(group.class_subject_id, list);
  }

  const expectedContexts: ClassReportCycleMissingContext[] = [];

  for (const classSubject of classSubjects) {
    const subject = subjectById.get(classSubject.subject_id);
    const groups =
      groupsByClassSubject.get(classSubject.id) ?? [];

    if (groups.length === 0) {
      expectedContexts.push({
        classSubjectId: classSubject.id,
        subjectGroupId: null,
        subjectNameEn:
          subject?.name_en ?? classSubject.id,
        subjectNameAr: subject?.name_ar ?? null,
        groupNameEn: null,
        groupNameAr: null
      });

      continue;
    }

    for (const group of groups) {
      expectedContexts.push({
        classSubjectId: classSubject.id,
        subjectGroupId: group.id,
        subjectNameEn:
          subject?.name_en ?? classSubject.id,
        subjectNameAr: subject?.name_ar ?? null,
        groupNameEn: group.name_en,
        groupNameAr: group.name_ar
      });
    }
  }

  const eligibleContextKeys = new Set(
    workspace.sources.map((source) =>
      contextKey(
        source.classSubjectId,
        source.subjectGroupId
      )
    )
  );

  const missingContexts = expectedContexts.filter(
    (context) =>
      !eligibleContextKeys.has(
        contextKey(
          context.classSubjectId,
          context.subjectGroupId
        )
      )
  );

  const reports = (
    reportsResult.data ?? []
  ) as unknown as Array<{
    id: string;
    student_id: string;
    revision: number;
    language: ReportLanguage;
    status: 'DRAFT' | 'READY' | 'SENT' | 'FAILED';
    students: {
      first_name_en: string;
      last_name_en: string;
      first_name_ar: string | null;
      last_name_ar: string | null;
    } | null;
  }>;

  return {
    ...workspace,
    missingContexts,
    canDismiss: dismissibleIds.has(batchId),
    // Preserve past snapshots in the database, but expose only the latest
    // revision of each student's report to the active preview and selector.
    reports: selectLatestReportRevisionsByStudent(reports).flatMap((report) => {
      if (!report.students) return [];

      return [{
        id: report.id,
        studentId: report.student_id,
        studentNameEn:
          `${report.students.first_name_en} ${report.students.last_name_en}`,
        studentNameAr:
          report.students.first_name_ar &&
          report.students.last_name_ar
            ? `${report.students.first_name_ar} ${report.students.last_name_ar}`
            : null,
        language: report.language,
        status: report.status
      }];
    })
  };
}

export async function listEligibleTeachingUpdateSources(
  batchId: string
): Promise<ReportBatchSource[]> {
  const workspace =
    await getClassReportCycleWorkspace(batchId);

  return workspace?.sources ?? [];
}

export async function setReportCycleSourceIncluded(
  batchId: string,
  submissionId: string,
  included: boolean
) {
  const typedDb = await createServerSupabaseClient();

  const {data: batch, error: batchError} = await typedDb
    .from('report_batches')
    .select('school_id')
    .eq('id', batchId)
    .maybeSingle();

  if (batchError) throw batchError;
  if (!batch) throw new Error('Report Cycle not found');

  const {data: approvals, error: approvalError} = await typedDb
    .from('report_section_approvals')
    .select('id')
    .eq('school_id', batch.school_id)
    .eq('batch_id', batchId);

  if (approvalError) throw approvalError;

  const approvalIds = (approvals ?? []).map(({id}) => id);

  let linked = false;

  if (approvalIds.length > 0) {
    const {data: existingLink, error: linkError} = await typedDb
      .from('report_section_sources')
      .select('id')
      .eq('school_id', batch.school_id)
      .eq('weekly_submission_id', submissionId)
      .in('approval_id', approvalIds)
      .limit(1)
      .maybeSingle();

    if (linkError) throw linkError;
    linked = Boolean(existingLink);
  }

  if (!linked) {
    await approveAllSubmittedSources(
      batch.school_id,
      batchId
    );
  }

  const db = typedDb as unknown as SupabaseClient;

  const {error} = await db.rpc(
    'set_report_cycle_source_included',
    {
      p_batch_id: batchId,
      p_submission_id: submissionId,
      p_included: included
    }
  );

  if (error) throw error;
}
