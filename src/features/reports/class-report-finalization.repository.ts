import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';

import {
  deriveReportAttendance,
  effectiveReportAttendance,
  type ReportAttendanceResolution
} from './report-attendance';
import {getReportBatchWorkspace} from './report-batch.repository';
import {eligibleReportSourcesForStudent} from './report-source-roster';
import {buildReportSnapshotV2} from './report.service';
import {getActiveReportTemplate} from './report-template.repository';
import type {
  ReportPerformance,
  ReportSnapshotV2
} from './report.types';
import {ensureClassReportCycleReview} from './class-report-review.repository';

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

function appendText(shared: string | null, extra: string | null) {
  if (!extra) return shared;
  return shared ? `${shared}\n\n${extra}` : extra;
}

function periodOverlaps(
  startsOn: string,
  endsOn: string | null,
  start: string,
  end: string
) {
  return startsOn <= end && (!endsOn || endsOn >= start);
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

type OverrideRow = {
  approval_id: string;
  student_id: string;
  progress_en: string | null;
  progress_ar: string | null;
  performance: ReportPerformance | null;
  performance_overridden: boolean;
  comment_en: string | null;
  comment_ar: string | null;
  attendance_attended: number | null;
  attendance_total: number | null;
};

type SnapshotResult = {
  studentId: string;
  studentNameEn: string;
  studentNameAr: string | null;
  snapshot: ReportSnapshotV2;
};

async function buildClassReportCycleSnapshots(
  schoolId: string,
  batchId: string,
  onlyStudentId?: string
): Promise<SnapshotResult[]> {
  await ensureClassReportCycleReview(schoolId, batchId);

  const workspace = await getReportBatchWorkspace(schoolId, batchId);
  if (!workspace || workspace.batch.scopeType !== 'CLASS') {
    throw new Error('Class Report Cycle not found');
  }
  if (workspace.batch.status === 'FINALIZED') {
    throw new Error('Report Cycle is already finalized');
  }

  const includedApprovals = workspace.approvals.filter(
    ({selectedSourceIds}) => selectedSourceIds.length > 0
  );
  const expectedContexts = new Set(
    workspace.sources
      .filter(({included}) => included)
      .map(
        ({classSubjectId, subjectGroupId}) =>
          `${classSubjectId}:${subjectGroupId ?? 'whole'}`
      )
  );
  const approvedContexts = new Set(
    includedApprovals.map(
      ({classSubjectId, subjectGroupId}) =>
        `${classSubjectId}:${subjectGroupId ?? 'whole'}`
    )
  );

  if (
    expectedContexts.size === 0 ||
    [...expectedContexts].some((key) => !approvedContexts.has(key))
  ) {
    throw new Error('Review included Teaching Updates before finalizing reports');
  }

  const db = await createServerSupabaseClient();
  const template = await getActiveReportTemplate(schoolId);
  const sourceIds = workspace.sources
    .filter(({included}) => included)
    .map(({id}) => id);
  const approvalIds = includedApprovals.map(({id}) => id);
  const classSubjectIds = [
    ...new Set(includedApprovals.map(({classSubjectId}) => classSubjectId))
  ];

  const [
    studentsResult,
    enrollmentsResult,
    exclusionsResult,
    membershipsResult,
    observationResult,
    resolutionResult,
    overrideResult
  ] = await Promise.all([
    db
      .from('students')
      .select('id,first_name_en,last_name_en,first_name_ar,last_name_ar')
      .eq('school_id', schoolId)
      .eq('is_active', true),
    db
      .from('class_enrollments')
      .select('student_id,starts_on,ends_on')
      .eq('school_id', schoolId)
      .eq('class_id', workspace.batch.classId),
    db
      .from('subject_exclusions')
      .select('student_id,class_subject_id,starts_on,ends_on')
      .eq('school_id', schoolId)
      .in('class_subject_id', classSubjectIds),
    db
      .from('subject_group_memberships')
      .select('student_id,class_subject_id,subject_group_id,starts_on,ends_on')
      .eq('school_id', schoolId)
      .in('class_subject_id', classSubjectIds),
    db
      .from('weekly_submission_students')
      .select(
        'submission_id,student_id,attendance_status,performance_override,comment_en,comment_ar'
      )
      .eq('school_id', schoolId)
      .in('submission_id', sourceIds),
    db
      .from('attendance_resolutions')
      .select(
        'class_subject_id,subject_group_id,week_start,student_id,resolved_status'
      )
      .eq('school_id', schoolId)
      .gte('week_start', workspace.batch.periodStart)
      .lte('week_start', workspace.batch.periodEnd)
      .in('class_subject_id', classSubjectIds),
    db
      .from('report_student_overrides')
      .select(
        'approval_id,student_id,progress_en,progress_ar,performance,performance_overridden,comment_en,comment_ar,attendance_attended,attendance_total'
      )
      .eq('school_id', schoolId)
      .in('approval_id', approvalIds)
  ]);

  for (const result of [
    studentsResult,
    enrollmentsResult,
    exclusionsResult,
    membershipsResult,
    observationResult,
    resolutionResult,
    overrideResult
  ]) {
    if (result.error) throw result.error;
  }

  const students = studentsResult.data ?? [];
  const enrollments = enrollmentsResult.data ?? [];
  const exclusions = exclusionsResult.data ?? [];
  const memberships = membershipsResult.data ?? [];
  const observations =
    (observationResult.data ?? []) as SubmissionStudentRow[];
  const resolutions =
    (resolutionResult.data ?? []) as ResolutionRow[];
  const overrides = (overrideResult.data ?? []) as OverrideRow[];
  const normalizedResolutions: ReportAttendanceResolution[] =
    resolutions.map((row) => ({
      classSubjectId: row.class_subject_id,
      subjectGroupId: row.subject_group_id,
      weekStart: row.week_start,
      studentId: row.student_id,
      resolvedStatus: row.resolved_status
    }));
  const enrolledIds = new Set(
    enrollments
      .filter((row) =>
        periodOverlaps(
          row.starts_on,
          row.ends_on,
          workspace.batch.periodStart,
          workspace.batch.periodEnd
        )
      )
      .map(({student_id}) => student_id)
  );
  const generatedAt = new Date().toISOString();
  const snapshots: SnapshotResult[] = [];

  for (const student of students) {
    if (onlyStudentId && student.id !== onlyStudentId) continue;
    if (!enrolledIds.has(student.id)) continue;
    const sections = [];

    for (const approval of includedApprovals) {
      const approvedSources = workspace.sources.filter((source) =>
        approval.selectedSourceIds.includes(source.id)
      );
      const selectedSources = eligibleReportSourcesForStudent({
        studentId: student.id,
        classSubjectId: approval.classSubjectId,
        subjectGroupId: approval.subjectGroupId,
        reportStart: workspace.batch.periodStart,
        reportEnd: workspace.batch.periodEnd,
        sources: approvedSources,
        enrollments,
        memberships,
        exclusions
      });
      if (selectedSources.length === 0) continue;
      const selectedIds = new Set(selectedSources.map(({id}) => id));
      const partialCoverage = selectedSources.length !== approvedSources.length;

      const studentObservations = observations.filter(
        (row) =>
          row.student_id === student.id &&
          selectedIds.has(row.submission_id)
      );
      const explicitOverride = overrides.find(
        (row) =>
          row.approval_id === approval.id &&
          row.student_id === student.id
      );
      const sourceAttendance = deriveReportAttendance({
        sources: selectedSources.map(({id, weekStart}) => ({id, weekStart})),
        observations: studentObservations.map((row) => ({
          submissionId: row.submission_id,
          studentId: row.student_id,
          attendanceStatus: row.attendance_status
        })),
        resolutions: normalizedResolutions,
        classSubjectId: approval.classSubjectId,
        subjectGroupId: approval.subjectGroupId,
        studentId: student.id
      });
      const attendance = effectiveReportAttendance(
        sourceAttendance,
        explicitOverride?.attendance_attended,
        explicitOverride?.attendance_total
      );

      const sourcePerformance = studentObservations
        .map(({performance_override}) => performance_override)
        .filter((value): value is ReportPerformance => value !== null)
        .at(-1) ?? null;
      const sourceCommentEn = joinUnique(
        studentObservations.map(({comment_en}) => comment_en)
      );
      const sourceCommentAr = joinUnique(
        studentObservations.map(({comment_ar}) => comment_ar)
      );
      const source = selectedSources[0]!;

      sections.push({
        classSubjectId: approval.classSubjectId,
        subjectNameEn: source.subjectNameEn,
        subjectNameAr: source.subjectNameAr,
        groupNameEn: source.groupNameEn,
        groupNameAr: source.groupNameAr,
        // The report approval is the authoritative version for this
        // cycle, including when only some Teacher sources were selected.
        // An earlier partial-coverage fallback could silently replace
        // Admin-approved text with raw Teacher text in final reports.
        approvedProgressEn:
          clean(explicitOverride?.progress_en) ??
          approval.approvedProgressEn ??
          joinUnique(selectedSources.map(({progressEn}) => progressEn)),
        approvedProgressAr:
          clean(explicitOverride?.progress_ar) ??
          approval.approvedProgressAr ??
          joinUnique(selectedSources.map(({progressAr}) => progressAr),
        performance: explicitOverride?.performance_overridden
          ? explicitOverride.performance
          : sourcePerformance ?? (partialCoverage
            ? selectedSources
                .map(({performance}) => performance)
                .filter((value): value is ReportPerformance => value !== null)
                .at(-1) ?? null
            : approval.performance),
        attendance: {
          present: attendance.attended,
          absent: attendance.total - attendance.attended,
          sessions: attendance.total
        },
        commentEn: appendText(
          partialCoverage ? null : approval.commentEn,
          clean(explicitOverride?.comment_en) ?? sourceCommentEn
        ),
        commentAr: appendText(
          partialCoverage ? null : approval.commentAr,
          clean(explicitOverride?.comment_ar) ?? sourceCommentAr
        ),
        sourceTeacherNames: selectedSources.map(({teacherName}) => teacherName),
        unresolvedAttendanceConflicts: attendance.unresolvedConflicts
      });
    }

    if (sections.length === 0) continue;

    const built = buildReportSnapshotV2({
      school: {
        nameEn: workspace.school.nameEn,
        nameAr: workspace.school.nameAr ?? workspace.school.nameEn
      },
      student: {
        id: student.id,
        nameEn: `${student.first_name_en} ${student.last_name_en}`,
        nameAr:
          student.first_name_ar && student.last_name_ar
            ? `${student.first_name_ar} ${student.last_name_ar}`
            : null
      },
      class: workspace.classInfo,
      period: {
        start: workspace.batch.periodStart,
        end: workspace.batch.periodEnd
      },
      language: 'both',
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

    if (!built.snapshot) {
      throw new Error(
        'Unresolved attendance conflicts block report finalization'
      );
    }

    snapshots.push({
      studentId: student.id,
      studentNameEn: `${student.first_name_en} ${student.last_name_en}`,
      studentNameAr:
        student.first_name_ar && student.last_name_ar
          ? `${student.first_name_ar} ${student.last_name_ar}`
          : null,
      snapshot: built.snapshot
    });
  }

  return snapshots;
}

export async function getClassReportCycleLivePreview(
  schoolId: string,
  batchId: string,
  studentId: string
) {
  const snapshots = await buildClassReportCycleSnapshots(
    schoolId,
    batchId,
    studentId
  );
  return snapshots[0] ?? null;
}

export async function finalizeClassReportCycleReports(
  schoolId: string,
  batchId: string
) {
  const snapshots = await buildClassReportCycleSnapshots(schoolId, batchId);
  if (snapshots.length === 0) {
    throw new Error('No student reports are ready to finalize');
  }

  const db = await createServerSupabaseClient();
  const {data, error} = await db.rpc('finalize_report_batch', {
    p_batch_id: batchId,
    p_reports: snapshots.map(({studentId, snapshot}) => ({
      student_id: studentId,
      language: 'both',
      snapshot_json: snapshot
    }))
  });

  if (error) throw error;
  return data as number;
}