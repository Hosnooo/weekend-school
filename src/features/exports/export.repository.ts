import 'server-only';

import type {Locale} from '@/i18n/config';
import type {ReportSnapshot, ReportSnapshotV2} from '@/features/reports/report.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';

import type {ExportGenerationData, ExportTabularRow, FinalizedReportExport} from './export.generate';
import {
  recordMatchesExportRequest,
  validateExportRequest,
  type ExportRecordContext,
  type ExportRequest,
  type ExportRequestInput
} from './export.service';

export type StoredExportRequest = {
  id: string;
  schoolId: string;
  requestedByProfileId: string;
  request: ExportRequest;
  expiresAt: string;
};

export type ExportActor = {
  id: string;
  schoolId: string;
  isAdministrator: boolean;
  isActive: boolean;
};

function localizedLabel(en: string, ar: string | null, locale: Locale) {
  return locale === 'ar' && ar?.trim() ? ar : en;
}

function requireResult(error: {message?: string; code?: string} | null) {
  if (error) throw error;
}

export async function getCurrentExportActor(): Promise<ExportActor | null> {
  const supabase = await createServerSupabaseClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return null;

  const [{data, error}, {data: isAdministrator, error: administratorError}] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, school_id, is_active')
      .eq('auth_user_id', user.id)
      .maybeSingle(),
    supabase.rpc('is_admin')
  ]);
  if (error) throw error;
  if (administratorError) throw administratorError;
  if (!data) return null;

  return {
    id: data.id,
    schoolId: data.school_id,
    isAdministrator: Boolean(isAdministrator),
    isActive: data.is_active
  };
}

export async function getSchoolTimezone(schoolId: string) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('schools')
    .select('timezone')
    .eq('id', schoolId)
    .single();
  if (error) throw error;
  return data.timezone as string;
}

export async function listExportOptions(schoolId: string, locale: Locale) {
  const supabase = await createServerSupabaseClient();
  const [classesResult, subjectsResult, classSubjectsResult, groupsResult, studentsResult, teachersResult] = await Promise.all([
    supabase.from('classes').select('id, name_en, name_ar').eq('school_id', schoolId).eq('is_active', true).order('name_en'),
    supabase.from('subjects').select('id, name_en, name_ar').eq('school_id', schoolId).eq('is_active', true).order('name_en'),
    supabase.from('class_subjects').select('id, class_id, subject_id').eq('school_id', schoolId).eq('is_active', true),
    supabase.from('subject_groups').select('id, class_subject_id, name_en, name_ar').eq('school_id', schoolId).eq('is_active', true).order('name_en'),
    supabase.from('students').select('id, first_name_en, last_name_en, first_name_ar, last_name_ar').eq('school_id', schoolId).order('last_name_en').order('first_name_en'),
    supabase.from('teachers').select('id, display_name').eq('school_id', schoolId).eq('is_active', true).order('display_name')
  ]);

  for (const result of [classesResult, subjectsResult, classSubjectsResult, groupsResult, studentsResult, teachersResult]) {
    requireResult(result.error);
  }

  const subjectMap = new Map((subjectsResult.data ?? []).map((subject) => [subject.id, subject]));

  return {
    classes: (classesResult.data ?? []).map((item) => ({
      id: item.id,
      label: localizedLabel(item.name_en, item.name_ar, locale)
    })),
    subjects: (classSubjectsResult.data ?? []).map((item) => {
      const subject = subjectMap.get(item.subject_id);
      return {
        id: item.id,
        classId: item.class_id,
        label: subject ? localizedLabel(subject.name_en, subject.name_ar, locale) : item.id
      };
    }),
    groups: (groupsResult.data ?? []).map((item) => ({
      id: item.id,
      classSubjectId: item.class_subject_id,
      label: localizedLabel(item.name_en, item.name_ar, locale)
    })),
    students: (studentsResult.data ?? []).map((item) => ({
      id: item.id,
      label: locale === 'ar' && item.first_name_ar && item.last_name_ar
        ? `${item.first_name_ar} ${item.last_name_ar}`
        : `${item.first_name_en} ${item.last_name_en}`
    })),
    teachers: (teachersResult.data ?? []).map((item) => ({id: item.id, label: item.display_name}))
  };
}

export async function createExportRequest(input: {
  schoolId: string;
  requestedByProfileId: string;
  request: ExportRequestInput;
  ttlMinutes?: number;
}) {
  const request = validateExportRequest(input.request);
  const ttlMinutes = input.ttlMinutes ?? 15;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('export_requests')
    .insert({
      school_id: input.schoolId,
      requested_by_profile_id: input.requestedByProfileId,
      request,
      expires_at: expiresAt
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function getStoredExportRequest(exportId: string): Promise<StoredExportRequest | null> {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('export_requests')
    .select('id, school_id, requested_by_profile_id, request, expires_at')
    .eq('id', exportId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    schoolId: data.school_id,
    requestedByProfileId: data.requested_by_profile_id,
    request: validateExportRequest(data.request as ExportRequestInput),
    expiresAt: data.expires_at
  };
}

function periodOverlaps(startsOn: string, endsOn: string | null, request: ExportRequest) {
  if (!request.periodStart || !request.periodEnd) return true;
  return startsOn <= request.periodEnd && (!endsOn || endsOn >= request.periodStart);
}

function snapshotClassId(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const candidate = snapshot as {version?: unknown; class?: {id?: unknown}};
  return candidate.version === 2 && typeof candidate.class?.id === 'string' ? candidate.class.id : null;
}

function snapshotHasScope(snapshot: unknown, request: ExportRequest) {
  if (request.scope.type !== 'SUBJECT' && request.scope.type !== 'GROUP') return true;
  if (!snapshot || typeof snapshot !== 'object') return false;
  const candidate = snapshot as {
    version?: unknown;
    sections?: Array<{classSubjectId?: unknown; subjectGroupId?: unknown}>;
  };
  if (candidate.version !== 2 || !Array.isArray(candidate.sections)) return false;
  return candidate.sections.some((section) => {
    if (section.classSubjectId !== request.scope.classSubjectId) return false;
    return request.scope.type === 'SUBJECT' || section.subjectGroupId === request.scope.subjectGroupId;
  });
}

function uniqueRows(rows: ExportTabularRow[], key: string) {
  const seen = new Set<unknown>();
  return rows.filter((row) => {
    const value = row[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function matches(record: ExportRecordContext, request: ExportRequest) {
  return recordMatchesExportRequest(record, request);
}

export async function collectExportGenerationData(
  schoolId: string,
  rawRequest: ExportRequestInput
): Promise<ExportGenerationData> {
  const request = validateExportRequest(rawRequest);
  const supabase = await createServerSupabaseClient();

  const [
    studentsResult,
    enrollmentsResult,
    membershipsResult,
    exclusionsResult,
    classSubjectsResult,
    assignmentsResult,
    submissionsResult,
    submissionStudentsResult,
    reportsResult,
    deliveriesResult
  ] = await Promise.all([
    supabase.from('students').select('id, first_name_en, last_name_en, first_name_ar, last_name_ar, is_active, created_at').eq('school_id', schoolId),
    supabase.from('class_enrollments').select('id, class_id, student_id, starts_on, ends_on').eq('school_id', schoolId),
    supabase.from('subject_group_memberships').select('id, class_subject_id, subject_group_id, student_id, starts_on, ends_on').eq('school_id', schoolId),
    supabase.from('subject_exclusions').select('class_subject_id, student_id, starts_on, ends_on').eq('school_id', schoolId),
    supabase.from('class_subjects').select('id, class_id').eq('school_id', schoolId),
    supabase.from('teaching_assignments').select('id, teacher_id, class_subject_id, subject_group_id, starts_on, ends_on').eq('school_id', schoolId),
    supabase.from('weekly_submissions').select('id, class_subject_id, subject_group_id, teacher_id, week_start, status, progress_en, progress_ar, default_performance, submitted_at').eq('school_id', schoolId),
    supabase.from('weekly_submission_students').select('id, submission_id, student_id, attendance_status, performance_override, comment_en, comment_ar').eq('school_id', schoolId),
    supabase.from('reports').select('id, student_id, period_start, period_end, language, status, snapshot_json, revision, finalized_at, generated_at').eq('school_id', schoolId),
    supabase.from('email_deliveries').select('id, report_id, student_id, period_start, period_end, recipient_email, status, sent_at, created_at').eq('school_id', schoolId)
  ]);

  for (const result of [
    studentsResult,
    enrollmentsResult,
    membershipsResult,
    exclusionsResult,
    classSubjectsResult,
    assignmentsResult,
    submissionsResult,
    submissionStudentsResult,
    reportsResult,
    deliveriesResult
  ]) {
    requireResult(result.error);
  }

  const classSubjectMap = new Map((classSubjectsResult.data ?? []).map((row) => [row.id, row.class_id]));
  const submissionMap = new Map((submissionsResult.data ?? []).map((row) => [row.id, row]));
  const reportMap = new Map((reportsResult.data ?? []).map((row) => [row.id, row]));
  const studentMap = new Map((studentsResult.data ?? []).map((row) => [row.id, row]));
  const rows: Partial<Record<ExportRequest['datasets'][number], ExportTabularRow[]>> = {};

  if (request.datasets.includes('STUDENTS')) {
    const studentRows: ExportTabularRow[] = [];
    for (const student of studentsResult.data ?? []) {
      const base = {
        studentId: student.id,
        nameEn: `${student.first_name_en} ${student.last_name_en}`,
        nameAr: student.first_name_ar && student.last_name_ar ? `${student.first_name_ar} ${student.last_name_ar}` : '',
        active: student.is_active
      };

      if (request.scope.type === 'SCHOOL' || request.scope.type === 'STUDENT') {
        if (matches({studentId: student.id}, request)) studentRows.push(base);
        continue;
      }
      if (request.scope.type === 'TEACHER') continue;

      if (request.scope.type === 'GROUP') {
        const relevant = (membershipsResult.data ?? []).some((membership) =>
          membership.student_id === student.id &&
          membership.subject_group_id === request.scope.subjectGroupId &&
          periodOverlaps(membership.starts_on, membership.ends_on, request)
        );
        if (relevant) studentRows.push({...base, classId: request.scope.classId, classSubjectId: request.scope.classSubjectId, subjectGroupId: request.scope.subjectGroupId});
        continue;
      }

      const classId = request.scope.classId;
      const enrolled = (enrollmentsResult.data ?? []).some((enrollment) =>
        enrollment.student_id === student.id && enrollment.class_id === classId &&
        periodOverlaps(enrollment.starts_on, enrollment.ends_on, request)
      );
      if (!enrolled) continue;

      if (request.scope.type === 'SUBJECT') {
        const excluded = (exclusionsResult.data ?? []).some((exclusion) =>
          exclusion.student_id === student.id &&
          exclusion.class_subject_id === request.scope.classSubjectId &&
          periodOverlaps(exclusion.starts_on, exclusion.ends_on, request)
        );
        if (!excluded) studentRows.push({...base, classId, classSubjectId: request.scope.classSubjectId});
      } else {
        studentRows.push({...base, classId});
      }
    }
    rows.STUDENTS = uniqueRows(studentRows, 'studentId');
  }

  if (request.datasets.includes('MEMBERSHIPS')) {
    const membershipRows: ExportTabularRow[] = [];
    for (const enrollment of enrollmentsResult.data ?? []) {
      if (!periodOverlaps(enrollment.starts_on, enrollment.ends_on, request)) continue;
      const context = {studentId: enrollment.student_id, classId: enrollment.class_id};
      if (matches(context, request)) membershipRows.push({
        type: 'CLASS_ENROLLMENT',
        ...context,
        startsOn: enrollment.starts_on,
        endsOn: enrollment.ends_on
      });
    }
    for (const membership of membershipsResult.data ?? []) {
      if (!periodOverlaps(membership.starts_on, membership.ends_on, request)) continue;
      const context = {
        studentId: membership.student_id,
        classId: classSubjectMap.get(membership.class_subject_id) ?? null,
        classSubjectId: membership.class_subject_id,
        subjectGroupId: membership.subject_group_id
      };
      if (matches(context, request)) membershipRows.push({
        type: 'SUBJECT_GROUP_MEMBERSHIP',
        ...context,
        startsOn: membership.starts_on,
        endsOn: membership.ends_on
      });
    }
    for (const assignment of assignmentsResult.data ?? []) {
      if (!periodOverlaps(assignment.starts_on, assignment.ends_on, request)) continue;
      const context = {
        teacherId: assignment.teacher_id,
        classId: classSubjectMap.get(assignment.class_subject_id) ?? null,
        classSubjectId: assignment.class_subject_id,
        subjectGroupId: assignment.subject_group_id
      };
      if (matches(context, request)) membershipRows.push({
        type: 'TEACHING_ASSIGNMENT',
        ...context,
        startsOn: assignment.starts_on,
        endsOn: assignment.ends_on
      });
    }
    rows.MEMBERSHIPS = membershipRows;
  }

  const observationRows = (submissionStudentsResult.data ?? []).flatMap((studentRow) => {
    const submission = submissionMap.get(studentRow.submission_id);
    if (!submission) return [];
    const context = {
      occurredOn: submission.week_start,
      studentId: studentRow.student_id,
      teacherId: submission.teacher_id,
      classId: classSubjectMap.get(submission.class_subject_id) ?? null,
      classSubjectId: submission.class_subject_id,
      subjectGroupId: submission.subject_group_id
    };
    if (!matches(context, request)) return [];
    return [{studentRow, submission, context}];
  });

  if (request.datasets.includes('ATTENDANCE')) {
    rows.ATTENDANCE = observationRows.map(({studentRow, submission, context}) => ({
      ...context,
      submissionId: submission.id,
      submissionStatus: submission.status,
      attendance: studentRow.attendance_status,
      performance: studentRow.performance_override ?? submission.default_performance
    }));
  }

  if (request.datasets.includes('COMMENTS')) {
    rows.COMMENTS = observationRows
      .filter(({studentRow}) => studentRow.comment_en || studentRow.comment_ar)
      .map(({studentRow, submission, context}) => ({
        ...context,
        submissionId: submission.id,
        commentEn: studentRow.comment_en,
        commentAr: studentRow.comment_ar
      }));
  }

  const reportRows = (reportsResult.data ?? []).flatMap((report) => {
    if (!periodOverlaps(report.period_start, report.period_end, request)) return [];
    const classId = snapshotClassId(report.snapshot_json);
    const context: ExportRecordContext = {studentId: report.student_id, classId};
    if (request.scope.type === 'SUBJECT') context.classSubjectId = request.scope.classSubjectId;
    if (request.scope.type === 'GROUP') {
      context.classSubjectId = request.scope.classSubjectId;
      context.subjectGroupId = request.scope.subjectGroupId;
    }
    if (!snapshotHasScope(report.snapshot_json, request) || !matches(context, request)) return [];
    return [{report, context}];
  });

  if (request.datasets.includes('REPORTS')) {
    rows.REPORTS = reportRows.map(({report, context}) => ({
      ...context,
      reportId: report.id,
      periodStart: report.period_start,
      periodEnd: report.period_end,
      language: report.language,
      status: report.status,
      revision: report.revision,
      finalizedAt: report.finalized_at,
      generatedAt: report.generated_at
    }));
  }

  if (request.datasets.includes('DELIVERIES')) {
    rows.DELIVERIES = (deliveriesResult.data ?? []).flatMap((delivery) => {
      if (!periodOverlaps(delivery.period_start, delivery.period_end, request)) return [];
      const report = reportMap.get(delivery.report_id);
      const context = {
        studentId: delivery.student_id,
        classId: report ? snapshotClassId(report.snapshot_json) : null
      };
      if (!matches(context, request)) return [];
      return [{
        ...context,
        deliveryId: delivery.id,
        reportId: delivery.report_id,
        periodStart: delivery.period_start,
        periodEnd: delivery.period_end,
        recipientEmail: delivery.recipient_email,
        status: delivery.status,
        sentAt: delivery.sent_at,
        createdAt: delivery.created_at
      }];
    });
  }

  const pdfSafeScope = request.scope.type === 'SCHOOL' || request.scope.type === 'CLASS' || request.scope.type === 'STUDENT';
  const finalizedReports: FinalizedReportExport[] = request.includeFinalizedReportPdfs && request.datasets.includes('REPORTS') && pdfSafeScope
    ? reportRows.flatMap(({report}) => {
        if (!report.finalized_at) return [];
        const student = studentMap.get(report.student_id);
        if (!student) return [];
        return [{
          reportId: report.id,
          studentName: `${student.first_name_en} ${student.last_name_en}`,
          snapshot: report.snapshot_json as ReportSnapshot | ReportSnapshotV2
        }];
      })
    : [];

  return {rows, finalizedReports};
}
