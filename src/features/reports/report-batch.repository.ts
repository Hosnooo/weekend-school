import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';

import {buildReportSnapshotV2} from './report.service';
import {getActiveReportTemplate} from './report-template.repository';
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
  performance: ReportPerformance | null;
  comment_en: string | null;
  comment_ar: string | null;
};

type StudentObservationRow = {
  submission_id: string;
  student_id: string;
  attendance_status: 'PRESENT' | 'ABSENT';
  performance_override: ReportPerformance | null;
  comment_en: string | null;
  comment_ar: string | null;
};

export type ReportBatchSource = {
  id: string;
  classSubjectId: string;
  subjectGroupId: string | null;
  weekStart: string;
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

  let submissions: SubmissionRow[] = [];
  if (classSubjectIds.length > 0) {
    const submissionResult = await db.from('weekly_submissions')
      .select('id,class_subject_id,subject_group_id,teacher_id,week_start,progress_en,progress_ar,default_performance')
      .eq('school_id', schoolId)
      .eq('status', 'SUBMITTED')
      .gte('week_start', batch.period_start)
      .lte('week_start', batch.period_end)
      .in('class_subject_id', classSubjectIds)
      .order('week_start');
    if (submissionResult.error) throw submissionResult.error;
    submissions = (submissionResult.data ?? []) as SubmissionRow[];
    if (batch.scope_type === 'GROUP') {
      submissions = submissions.filter(({subject_group_id}) => subject_group_id === batch.subject_group_id);
    }
  }

  const teacherIds = [...new Set(submissions.map(({teacher_id}) => teacher_id))];
  const teachersResult = teacherIds.length > 0
    ? await db.from('teachers').select('id,display_name').eq('school_id', schoolId).in('id', teacherIds)
    : {data: [], error: null};
  requireNoError(teachersResult.error);

  const approvalResult = await db.from('report_section_approvals')
    .select('id,class_subject_id,subject_group_id,approved_progress_en,approved_progress_ar,performance,comment_en,comment_ar')
    .eq('school_id', schoolId).eq('batch_id', batch.id);
  if (approvalResult.error) throw approvalResult.error;
  const approvalRows = (approvalResult.data ?? []) as ApprovalRow[];
  const approvalIds = approvalRows.map(({id}) => id);
  const linksResult = approvalIds.length > 0
    ? await db.from('report_section_sources').select('approval_id,weekly_submission_id').eq('school_id', schoolId).in('approval_id', approvalIds)
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
            'submission_id,student_id,attendance_status,performance_override,comment_en,comment_ar'
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
  const sourceLinks = (linksResult.data ?? []) as Array<{approval_id: string; weekly_submission_id: string}>;

  const sources: ReportBatchSource[] = submissions.map((row) => {
    const subject = subjectById.get(subjectIdByClassSubject.get(row.class_subject_id) ?? '');
    const group = row.subject_group_id ? groupById.get(row.subject_group_id) : null;
    return {
      id: row.id,
      classSubjectId: row.class_subject_id,
      subjectGroupId: row.subject_group_id,
      weekStart: row.week_start,
      teacherId: row.teacher_id,
      teacherName: teacherById.get(row.teacher_id) ?? 'Teacher',
      subjectNameEn: subject?.name_en ?? row.class_subject_id,
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
    performance: row.performance,
    commentEn: row.comment_en,
    commentAr: row.comment_ar,
    selectedSourceIds: sourceLinks
      .filter(({approval_id}) => approval_id === row.id)
      .map(({weekly_submission_id}) => weekly_submission_id)
  }));

  const expectedContexts = new Set(
    sources.map((source) =>
      contextKey(source.classSubjectId, source.subjectGroupId)
    )
  ).size;

  const approvedContexts = new Set(
    approvals.map((approval) =>
      contextKey(approval.classSubjectId, approval.subjectGroupId)
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
        statuses.add(observation.attendance_status);
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
        presentCount: studentObservations.filter(
          ({attendance_status}) => attendance_status === 'PRESENT'
        ).length,
        absentCount: studentObservations.filter(
          ({attendance_status}) => attendance_status === 'ABSENT'
        ).length,
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
  if (workspace.sources.length === 0) throw new Error('No submitted teaching sources are available for this batch');

  const db = await createServerSupabaseClient();
  const grouped = new Map<string, ReportBatchSource[]>();
  for (const source of workspace.sources) {
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
      const {error} = await db.from('report_section_approvals').update(payload)
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
  const expected = new Set(workspace.sources.map((source) => contextKey(source.classSubjectId, source.subjectGroupId)));
  const approved = new Set(workspace.approvals.map((item) => contextKey(item.classSubjectId, item.subjectGroupId)));
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
  attendance_status: 'PRESENT' | 'ABSENT';
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

  if (workspace.approvals.length === 0) {
    throw new Error('Report batch has no approved sections');
  }

  const expectedContexts = new Set(
    workspace.sources.map((source) =>
      contextKey(
        source.classSubjectId,
        source.subjectGroupId
      )
    )
  );

  const approvedContexts = new Set(
    workspace.approvals.map((approval) =>
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
  const sourceIds = workspace.sources.map(({id}) => id);
  const approvalIds = workspace.approvals.map(({id}) => id);
  const classSubjectIds = [...new Set(workspace.approvals.map(({classSubjectId}) => classSubjectId))];

  const [studentsResult, enrollmentsResult, exclusionsResult, membershipsResult, observationResult, resolutionResult, guardianLinkResult, guardianResult, overrideResult] = await Promise.all([
    db.from('students').select('id,first_name_en,last_name_en,first_name_ar,last_name_ar').eq('school_id', schoolId).eq('is_active', true),
    db.from('class_enrollments').select('student_id,starts_on,ends_on').eq('school_id', schoolId).eq('class_id', workspace.batch.classId),
    db.from('subject_exclusions').select('student_id,class_subject_id,starts_on,ends_on').eq('school_id', schoolId).in('class_subject_id', classSubjectIds),
    db.from('subject_group_memberships').select('student_id,class_subject_id,subject_group_id,starts_on,ends_on').eq('school_id', schoolId).in('class_subject_id', classSubjectIds),
    db.from('weekly_submission_students').select('submission_id,student_id,attendance_status,performance_override,comment_en,comment_ar').eq('school_id', schoolId).in('submission_id', sourceIds),
    db.from('attendance_resolutions').select('class_subject_id,subject_group_id,week_start,student_id,resolved_status').eq('school_id', schoolId).gte('week_start', workspace.batch.periodStart).lte('week_start', workspace.batch.periodEnd).in('class_subject_id', classSubjectIds),
    db.from('student_guardians').select('student_id,guardian_id,receives_reports').eq('school_id', schoolId),
    db.from('guardians').select('id,report_language,is_active').eq('school_id', schoolId),
    db.from('report_student_overrides').select('approval_id,student_id,progress_en,progress_ar,performance,comment_en,comment_ar').eq('school_id', schoolId).in('approval_id', approvalIds)
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
      const observationsByWeek = new Map<string, Set<'PRESENT' | 'ABSENT'>>();
      for (const source of selectedSources) {
        const row = studentObservations.find((item) => item.submission_id === source.id);
        if (!row) continue;
        const statuses = observationsByWeek.get(source.weekStart) ?? new Set<'PRESENT' | 'ABSENT'>();
        statuses.add(row.attendance_status);
        observationsByWeek.set(source.weekStart, statuses);
      }

      let present = 0;
      let absent = 0;
      let unresolvedAttendanceConflicts = 0;
      for (const [weekStart, statuses] of observationsByWeek) {
        let official: 'PRESENT' | 'ABSENT' | null = statuses.size === 1 ? [...statuses][0]! : null;
        if (statuses.size > 1) {
          official = resolutions.find((row) =>
            row.class_subject_id === approval.classSubjectId &&
            row.subject_group_id === approval.subjectGroupId &&
            row.week_start === weekStart && row.student_id === student.id
          )?.resolved_status ?? null;
          if (!official) unresolvedAttendanceConflicts += 1;
        }
        if (official === 'PRESENT') present += 1;
        if (official === 'ABSENT') absent += 1;
      }

      const explicitOverride = overrides.find((row) => row.approval_id === approval.id && row.student_id === student.id);
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
        approvedProgressEn: clean(explicitOverride?.progress_en) ?? approval.approvedProgressEn,
        approvedProgressAr: clean(explicitOverride?.progress_ar) ?? approval.approvedProgressAr,
        performance: (explicitOverride?.performance as ReportPerformance | null | undefined) ?? sourcePerformance ?? approval.performance,
        attendance: {present, absent, sessions: present + absent},
        commentEn: appendText(approval.commentEn, clean(explicitOverride?.comment_en) ?? sourceCommentEn),
        commentAr: appendText(approval.commentAr, clean(explicitOverride?.comment_ar) ?? sourceCommentAr),
        sourceTeacherNames: selectedSources.map(({teacherName}) => teacherName),
        unresolvedAttendanceConflicts
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
          closingAr: template.closingAr
        },
        generatedAt
      });
      if (!built.snapshot) {
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
