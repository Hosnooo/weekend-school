import 'server-only';

import type {SupabaseClient} from '@supabase/supabase-js';

import {createServerSupabaseClient} from '@/lib/supabase/server';

import {
  getReportBatchWorkspace,
  type ReportBatchApproval,
  type ReportBatchSource
} from './report-batch.repository';
import {getActiveReportTemplate} from './report-template.repository';
import type {ReportPerformance} from './report.types';
import {eligibleReportSourcesForStudent} from './report-source-roster';

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function joinUnique(values: Array<string | null | undefined>) {
  const unique = [
    ...new Set(
      values
        .map(clean)
        .filter((value): value is string => value !== null)
    )
  ];

  return unique.length > 0 ? unique.join('\n\n') : null;
}

function contextKey(
  classSubjectId: string,
  subjectGroupId: string | null
) {
  return `${classSubjectId}:${subjectGroupId ?? 'whole'}`;
}

type OverrideRow = {
  approval_id: string;
  student_id: string;
  progress_en: string | null;
  progress_ar: string | null;
  performance: ReportPerformance | null;
  performance_overridden: boolean;
  comment_en: string | null;
  comment_ar: string | null;
};

type ObservationRow = {
  submission_id: string;
  student_id: string;
  performance_override: ReportPerformance | null;
  comment_en: string | null;
  comment_ar: string | null;
};

export type ClassReportReviewStudent = {
  studentId: string;
  studentNameEn: string;
  studentNameAr: string | null;
  /** Included Teaching Updates overlapping this student's effective dates. */
  applicableSourceIds: string[];
  progressEn: string | null;
  progressAr: string | null;
  performance: ReportPerformance | null;
  performanceOverridden: boolean;
  commentEn: string | null;
  commentAr: string | null;
};

export type ClassReportReviewContext = {
  approvalId: string | null;
  classSubjectId: string;
  subjectGroupId: string | null;
  subjectNameEn: string;
  subjectNameAr: string | null;
  groupNameEn: string | null;
  groupNameAr: string | null;
  mainReportEn: string | null;
  mainReportAr: string | null;
  sources: ReportBatchSource[];
  students: ClassReportReviewStudent[];
};

export type ClassReportReviewWorkspace = {
  batchId: string;
  status: 'DRAFT' | 'REVIEW' | 'FINALIZED';
  template: Awaited<ReturnType<typeof getActiveReportTemplate>>;
  contexts: ClassReportReviewContext[];
};

function approvalForContext(
  approvals: ReportBatchApproval[],
  classSubjectId: string,
  subjectGroupId: string | null
) {
  return approvals.find(
    (approval) =>
      approval.classSubjectId === classSubjectId &&
      approval.subjectGroupId === subjectGroupId
  ) ?? null;
}

export async function getClassReportReviewWorkspace(
  schoolId: string,
  batchId: string
): Promise<ClassReportReviewWorkspace | null> {
  const workspace = await getReportBatchWorkspace(schoolId, batchId);
  if (!workspace || workspace.batch.scopeType !== 'CLASS') return null;

  const template = await getActiveReportTemplate(schoolId);
  const includedSources = workspace.sources.filter(({included}) => included);
  const sourceIds = includedSources.map(({id}) => id);
  const approvalIds = workspace.approvals.map(({id}) => id);
  const classSubjectIds = [
    ...new Set(includedSources.map(({classSubjectId}) => classSubjectId))
  ];

  const db = await createServerSupabaseClient();
  const [overrideResult, observationResult, exclusionResult, membershipResult, enrollmentResult] =
    await Promise.all([
      approvalIds.length > 0
        ? db
            .from('report_student_overrides')
            .select(
              'approval_id,student_id,progress_en,progress_ar,performance,performance_overridden,comment_en,comment_ar'
            )
            .eq('school_id', schoolId)
            .in('approval_id', approvalIds)
        : Promise.resolve({data: [], error: null}),
      sourceIds.length > 0
        ? db
            .from('weekly_submission_students')
            .select(
              'submission_id,student_id,performance_override,comment_en,comment_ar'
            )
            .eq('school_id', schoolId)
            .in('submission_id', sourceIds)
        : Promise.resolve({data: [], error: null}),
      classSubjectIds.length > 0
        ? db
            .from('subject_exclusions')
            .select('student_id,class_subject_id,starts_on,ends_on')
            .eq('school_id', schoolId)
            .in('class_subject_id', classSubjectIds)
        : Promise.resolve({data: [], error: null}),
      classSubjectIds.length > 0
        ? db
            .from('subject_group_memberships')
            .select(
              'student_id,class_subject_id,subject_group_id,starts_on,ends_on'
            )
            .eq('school_id', schoolId)
            .in('class_subject_id', classSubjectIds)
        : Promise.resolve({data: [], error: null}),
      db
        .from('class_enrollments')
        .select('student_id,starts_on,ends_on')
        .eq('school_id', schoolId)
        .eq('class_id', workspace.batch.classId)
    ]);

  for (const result of [
    overrideResult,
    observationResult,
    exclusionResult,
    membershipResult,
    enrollmentResult
  ]) {
    if (result.error) throw result.error;
  }

  const overrides = (overrideResult.data ?? []) as OverrideRow[];
  const observations = (observationResult.data ?? []) as ObservationRow[];
  const exclusions = exclusionResult.data ?? [];
  const memberships = membershipResult.data ?? [];
  const enrollments = enrollmentResult.data ?? [];

  const grouped = new Map<string, ReportBatchSource[]>();
  for (const source of includedSources) {
    const key = contextKey(source.classSubjectId, source.subjectGroupId);
    grouped.set(key, [...(grouped.get(key) ?? []), source]);
  }

  const contexts: ClassReportReviewContext[] = [];

  for (const sources of grouped.values()) {
    const first = sources[0]!;
    const approval = approvalForContext(
      workspace.approvals,
      first.classSubjectId,
      first.subjectGroupId
    );
    const students = workspace.summaryStudents.flatMap((student) => {
      const applicableSources = eligibleReportSourcesForStudent({
        studentId: student.studentId,
        classSubjectId: first.classSubjectId,
        subjectGroupId: first.subjectGroupId,
        reportStart: workspace.batch.periodStart,
        reportEnd: workspace.batch.periodEnd,
        sources,
        enrollments,
        memberships,
        exclusions
      });
      if (applicableSources.length === 0) return [];
      const applicableSourceIds = new Set(
        applicableSources.map(({id}) => id)
      );

      const studentObservations = observations.filter(
        (row) =>
          row.student_id === student.studentId &&
          applicableSourceIds.has(row.submission_id)
      );
      const sourcePerformance = studentObservations
        .map(({performance_override}) => performance_override)
        .filter((value): value is ReportPerformance => value !== null)
        .at(-1) ??
        applicableSources
          .map(({performance}) => performance)
          .filter((value): value is ReportPerformance => value !== null)
          .at(-1) ??
        (applicableSources.length === sources.length
          ? approval?.performance
          : null) ??
        null;
      const sourceCommentEn = joinUnique(
        studentObservations.map(({comment_en}) => comment_en)
      );
      const sourceCommentAr = joinUnique(
        studentObservations.map(({comment_ar}) => comment_ar)
      );
      const override = approval
        ? overrides.find(
            (row) =>
              row.approval_id === approval.id &&
              row.student_id === student.studentId
          )
        : null;

      return [{
        studentId: student.studentId,
        studentNameEn: student.studentNameEn,
        studentNameAr: student.studentNameAr,
        applicableSourceIds: [...applicableSourceIds],
        progressEn: override?.progress_en ?? null,
        progressAr: override?.progress_ar ?? null,
        performance: override?.performance_overridden
          ? override.performance
          : sourcePerformance,
        performanceOverridden:
          override?.performance_overridden ?? false,
        commentEn: override?.comment_en ?? sourceCommentEn,
        commentAr: override?.comment_ar ?? sourceCommentAr
      }];
    });

    contexts.push({
      approvalId: approval?.id ?? null,
      classSubjectId: first.classSubjectId,
      subjectGroupId: first.subjectGroupId,
      subjectNameEn: first.subjectNameEn,
      subjectNameAr: first.subjectNameAr,
      groupNameEn: first.groupNameEn,
      groupNameAr: first.groupNameAr,
      mainReportEn:
        approval?.approvedProgressEn ??
        joinUnique(sources.map(({progressEn}) => progressEn)),
      mainReportAr:
        approval?.approvedProgressAr ??
        joinUnique(sources.map(({progressAr}) => progressAr)),
      sources,
      students
    });
  }

  return {
    batchId,
    status: workspace.batch.status,
    template,
    contexts
  };
}

async function ensureApprovalForContext(input: {
  schoolId: string;
  batchId: string;
  classSubjectId: string;
  subjectGroupId: string | null;
  mainReportEn?: string | null;
  mainReportAr?: string | null;
}) {
  const workspace = await getReportBatchWorkspace(
    input.schoolId,
    input.batchId
  );
  if (!workspace) throw new Error('Report Cycle not found');
  if (workspace.batch.status === 'FINALIZED') {
    throw new Error('Finalized reports must be reopened before editing');
  }

  const existing = approvalForContext(
    workspace.approvals,
    input.classSubjectId,
    input.subjectGroupId
  );
  const contextSources = workspace.sources.filter(
    (source) =>
      source.classSubjectId === input.classSubjectId &&
      source.subjectGroupId === input.subjectGroupId
  );
  const includedSources = contextSources.filter(({included}) => included);
  if (includedSources.length === 0) {
    throw new Error('No included Teaching Update is available for this report');
  }

  const db = await createServerSupabaseClient();
  let approvalId = existing?.id ?? null;

  if (!approvalId) {
    const {data, error} = await db
      .from('report_section_approvals')
      .insert({
        school_id: input.schoolId,
        batch_id: input.batchId,
        class_subject_id: input.classSubjectId,
        subject_group_id: input.subjectGroupId,
        approved_progress_en:
          clean(input.mainReportEn) ??
          joinUnique(includedSources.map(({progressEn}) => progressEn)),
        approved_progress_ar:
          clean(input.mainReportAr) ??
          joinUnique(includedSources.map(({progressAr}) => progressAr)),
        performance:
          includedSources
            .map(({performance}) => performance)
            .filter((value): value is ReportPerformance => value !== null)
            .at(-1) ?? null
      })
      .select('id')
      .single();

    if (error) throw error;
    approvalId = data.id as string;
  }

  const links = contextSources.map((source) => ({
    school_id: input.schoolId,
    approval_id: approvalId,
    weekly_submission_id: source.id,
    included: source.included
  }));

  if (links.length > 0) {
    const {error} = await db
      .from('report_section_sources')
      .upsert(links, {
        onConflict: 'school_id,approval_id,weekly_submission_id'
      });
    if (error) throw error;
  }

  return approvalId;
}

export async function ensureClassReportCycleReview(
  schoolId: string,
  batchId: string
) {
  const workspace = await getReportBatchWorkspace(schoolId, batchId);
  if (!workspace || workspace.batch.scopeType !== 'CLASS') {
    throw new Error('Class Report Cycle not found');
  }

  const contexts = new Map<string, ReportBatchSource>();
  for (const source of workspace.sources.filter(({included}) => included)) {
    contexts.set(
      contextKey(source.classSubjectId, source.subjectGroupId),
      source
    );
  }

  for (const source of contexts.values()) {
    await ensureApprovalForContext({
      schoolId,
      batchId,
      classSubjectId: source.classSubjectId,
      subjectGroupId: source.subjectGroupId
    });
  }
}

export async function saveClassReportReviewContext(input: {
  schoolId: string;
  batchId: string;
  classSubjectId: string;
  subjectGroupId: string | null;
  mainReportEn: string | null;
  mainReportAr: string | null;
  includePerformance: boolean;
  includeStudentComments: boolean;
  students: Array<{
    studentId: string;
    progressEn: string | null;
    progressAr: string | null;
    performance: ReportPerformance | null;
    performanceOverridden: boolean;
    commentEn: string | null;
    commentAr: string | null;
  }>;
}) {
  const approvalId = await ensureApprovalForContext({
    schoolId: input.schoolId,
    batchId: input.batchId,
    classSubjectId: input.classSubjectId,
    subjectGroupId: input.subjectGroupId,
    mainReportEn: input.mainReportEn,
    mainReportAr: input.mainReportAr
  });

  const db = await createServerSupabaseClient();
  const {error: approvalError} = await db
    .from('report_section_approvals')
    .update({
      approved_progress_en: clean(input.mainReportEn),
      approved_progress_ar: clean(input.mainReportAr)
    })
    .eq('school_id', input.schoolId)
    .eq('id', approvalId);
  if (approvalError) throw approvalError;

  for (const student of input.students) {
    const progressEn = clean(student.progressEn);
    const progressAr = clean(student.progressAr);
    const commentEn = input.includeStudentComments
      ? clean(student.commentEn)
      : null;
    const commentAr = input.includeStudentComments
      ? clean(student.commentAr)
      : null;
    const performanceOverridden =
      input.includePerformance && student.performanceOverridden;
    const performance = performanceOverridden
      ? student.performance
      : null;
    const hasOverride = Boolean(
      progressEn ||
      progressAr ||
      commentEn ||
      commentAr ||
      performanceOverridden
    );

    if (!hasOverride) {
      // Preserve any attendance override in this row. Clearing report fields
      // must not require DELETE permission or erase attendance corrections.
      const {error} = await db
        .from('report_student_overrides')
        .update({
          progress_en: null,
          progress_ar: null,
          performance: null,
          performance_overridden: false,
          comment_en: null,
          comment_ar: null
        })
        .eq('school_id', input.schoolId)
        .eq('approval_id', approvalId)
        .eq('student_id', student.studentId);
      if (error) throw error;
      continue;
    }

    const {error} = await db
      .from('report_student_overrides')
      .upsert({
        school_id: input.schoolId,
        approval_id: approvalId,
        student_id: student.studentId,
        progress_en: progressEn,
        progress_ar: progressAr,
        performance,
        performance_overridden: performanceOverridden,
        comment_en: commentEn,
        comment_ar: commentAr
      }, {
        onConflict: 'school_id,approval_id,student_id'
      });
    if (error) throw error;
  }
}

export async function rebuildClassReportReviewContext(input: {
  schoolId: string;
  batchId: string;
  classSubjectId: string;
  subjectGroupId: string | null;
}) {
  const workspace = await getReportBatchWorkspace(
    input.schoolId,
    input.batchId
  );
  if (!workspace) throw new Error('Report Cycle not found');
  if (workspace.batch.status === 'FINALIZED') {
    throw new Error('Finalized reports must be reopened before editing');
  }

  const approvalId = await ensureApprovalForContext(input);
  const sources = workspace.sources.filter(
    (source) =>
      source.included &&
      source.classSubjectId === input.classSubjectId &&
      source.subjectGroupId === input.subjectGroupId
  );

  const db = await createServerSupabaseClient();
  const {error} = await db
    .from('report_section_approvals')
    .update({
      approved_progress_en: joinUnique(sources.map(({progressEn}) => progressEn)),
      approved_progress_ar: joinUnique(sources.map(({progressAr}) => progressAr))
    })
    .eq('school_id', input.schoolId)
    .eq('id', approvalId);
  if (error) throw error;
}

export async function setClassReportCycleSourceIncluded(input: {
  batchId: string;
  submissionId: string;
  included: boolean;
}) {
  const typedDb = await createServerSupabaseClient();
  const {data: batch, error: batchError} = await typedDb
    .from('report_batches')
    .select('school_id,status')
    .eq('id', input.batchId)
    .maybeSingle();
  if (batchError) throw batchError;
  if (!batch) throw new Error('Report Cycle not found');
  if (batch.status === 'FINALIZED') {
    throw new Error('Finalized Report Cycles cannot be changed');
  }

  const workspace = await getReportBatchWorkspace(
    batch.school_id,
    input.batchId
  );
  const source = workspace?.sources.find(({id}) => id === input.submissionId);
  if (!source) throw new Error('Teaching Update source not found');

  const approvalId = await ensureApprovalForContext({
    schoolId: batch.school_id,
    batchId: input.batchId,
    classSubjectId: source.classSubjectId,
    subjectGroupId: source.subjectGroupId
  });

  const {error: linkError} = await typedDb
    .from('report_section_sources')
    .upsert({
      school_id: batch.school_id,
      approval_id: approvalId,
      weekly_submission_id: input.submissionId,
      included: input.included
    }, {
      onConflict: 'school_id,approval_id,weekly_submission_id'
    });
  if (linkError) throw linkError;

  const db = typedDb as unknown as SupabaseClient;
  const {error} = await db.rpc('set_report_cycle_source_included', {
    p_batch_id: input.batchId,
    p_submission_id: input.submissionId,
    p_included: input.included
  });
  if (error) throw error;
}
