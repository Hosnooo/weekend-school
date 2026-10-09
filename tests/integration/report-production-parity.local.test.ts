// Opt-in production-derived parity check. Runs only with a disposable Supabase
// restore. Never connect to a remote Supabase URL or send email.
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';

const state = vi.hoisted(() => ({
  db: null as SupabaseClient | null,
  schoolId: '',
  finalized: [] as Array<{
    student_id: string;
    language: string;
    snapshot_json: unknown;
  }>
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => state.db
}));
// The real helper can INSERT/UPSERT approval rows. Existing approvals are
// required in this fixture, so prevent all such writes in a read-only dry-run.
vi.mock('@/features/reports/class-report-review.repository', () => ({
  ensureClassReportCycleReview: async () => {}
}));
vi.mock('@/lib/auth/require-profile', () => ({
  requireProfile: async () => ({schoolId: state.schoolId})
}));
// Do not load or expose any guardian contact details in this test.
vi.mock('@/features/reports/class-report-preview.repository', () => ({
  getClassReportPreviewRecipients: async () => []
}));

import {
  finalizeClassReportCycleReports,
  getClassReportCycleLivePreview
} from '@/features/reports/class-report-finalization.repository';
import {getClassReportCycleEmailPreviewAction} from '@/features/reports/class-report-preview.actions';
import {getReportBatchWorkspace} from '@/features/reports/report-batch.repository';
import {eligibleReportSourcesForStudent} from '@/features/reports/report-source-roster';
import {renderReportEmail, renderReportEmailSubject} from '@/features/email/report-email';
import {renderStudentReportV2} from '@/features/reports/report.renderer';
import type {ReportSnapshotV2} from '@/features/reports/report.types';

const enabled = Boolean(process.env.REPORT_PARITY_URL);
type SavedOverride = {
  approval_id: string;
  student_id: string;
  attendance_attended: number | null;
  attendance_total: number | null;
  progress_en: string | null;
  progress_ar: string | null;
  progress_en_overridden: boolean;
  progress_ar_overridden: boolean;
  comment_en: string | null;
  comment_ar: string | null;
  comment_en_overridden: boolean;
  comment_ar_overridden: boolean;
  performance: string | null;
  performance_overridden: boolean;
};

function withoutGenerationTime(snapshot: ReportSnapshotV2) {
  return {...snapshot, generatedAt: null};
}

function htmlText(html: string) {
  return new DOMParser()
    .parseFromString(html, 'text/html')
    .body.textContent?.replace(/\s+/g, ' ') ?? '';
}

function assertVisibleText(body: string, value: string | null) {
  if (!value) return;
  for (const line of value.split(/\r?\n/).map((v) => v.trim()).filter(Boolean)) {
    expect(body).toContain(line);
  }
}

describe.skipIf(!enabled)('private restored-production report and email parity', () => {
  beforeAll(() => {
    const url = process.env.REPORT_PARITY_URL ?? '';
    const key = process.env.REPORT_PARITY_SERVICE_ROLE_KEY ?? '';
    // Refuse remote targets even if .env.local happens to reference production.
    if (url !== 'http://127.0.0.1:56421' || !key) {
      throw new Error('Only the disposable localhost:56421 Supabase fixture is allowed');
    }
    const actual = createClient(url, key, {
      auth: {persistSession: false, autoRefreshToken: false}
    });
    state.db = new Proxy(actual, {
      get(target, property) {
        if (property === 'rpc') {
          return (name: string, params: Record<string, unknown>) => {
            if (name !== 'finalize_report_batch') {
              throw new Error('Unexpected RPC in read-only report dry-run');
            }
            if (!Array.isArray(params.p_reports)) {
              throw new Error('Finalization payload is not an array');
            }
            const reports = params.p_reports as typeof state.finalized;
            state.finalized.push(...reports);
            return Promise.resolve({data: reports.length, error: null});
          };
        }
        const member = Reflect.get(target, property);
        return typeof member === 'function' ? member.bind(target) : member;
      }
    }) as SupabaseClient;
  });

  it('checks all three cycle finalization payloads against approvals, live previews and guardian emails', async () => {
    const db = state.db!;
    const {data: cycles, error: cycleError} = await db.from('report_batches')
      .select('id,school_id')
      .eq('scope_type', 'CLASS')
      .eq('status', 'DRAFT');
    if (cycleError) throw new Error('Unable to load restored cycle records');
    expect(cycles).toHaveLength(3);

    let reportsChecked = 0;
    let sectionsChecked = 0;
    let attendanceChecked = 0;
    let excludedAttendance = 0;
    let explicitFieldsChecked = 0;
    let studentOverrides = 0;

    for (const cycle of cycles ?? []) {
      state.schoolId = cycle.school_id;
      const workspace = await getReportBatchWorkspace(cycle.school_id, cycle.id);
      expect(workspace).not.toBeNull();
      const approvals = workspace!.approvals;
      const approvalIds = approvals.map((approval) => approval.id);
      expect(approvalIds.length).toBeGreaterThan(0);

      const {data: overrides, error: overrideError} = await db
        .from('report_student_overrides')
        .select('approval_id,student_id,attendance_attended,attendance_total,progress_en,progress_ar,progress_en_overridden,progress_ar_overridden,comment_en,comment_ar,comment_en_overridden,comment_ar_overridden,performance,performance_overridden')
        .eq('school_id', cycle.school_id)
        .in('approval_id', approvalIds);
      if (overrideError) throw new Error('Unable to load restored Admin override records');

      const subjectIds = [...new Set(approvals.map((a) => a.classSubjectId))];
      const [enrollmentResult, membershipResult, exclusionResult, studentResult] = await Promise.all([
        db.from('class_enrollments')
          .select('student_id,starts_on,ends_on')
          .eq('school_id', cycle.school_id).eq('class_id', workspace!.batch.classId),
        db.from('subject_group_memberships')
          .select('student_id,class_subject_id,subject_group_id,starts_on,ends_on')
          .eq('school_id', cycle.school_id).in('class_subject_id', subjectIds),
        db.from('subject_exclusions')
          .select('student_id,class_subject_id,starts_on,ends_on')
          .eq('school_id', cycle.school_id).in('class_subject_id', subjectIds),
        db.from('students').select('id')
          .eq('school_id', cycle.school_id).eq('is_active', true)
      ]);
      if ([enrollmentResult, membershipResult, exclusionResult, studentResult]
        .some((result) => result.error)) {
        throw new Error('Unable to load restored eligibility context');
      }
      const enrollments = enrollmentResult.data ?? [];
      const memberships = membershipResult.data ?? [];
      const exclusions = exclusionResult.data ?? [];
      const activeStudentIds = new Set((studentResult.data ?? []).map((row) => row.id));

      state.finalized.length = 0;
      const count = await finalizeClassReportCycleReports(cycle.school_id, cycle.id);
      const captured = [...state.finalized];
      expect(count).toBe(captured.length);
      expect(captured.length).toBeGreaterThan(0);
      const byStudent = new Map(captured.map((r) =>
        [r.student_id, r.snapshot_json as ReportSnapshotV2]
      ));

      for (const report of captured) {
        const snapshot = report.snapshot_json as ReportSnapshotV2;
        expect(report.language).toBe('both');
        expect(snapshot.version).toBe(2);
        const live = await getClassReportCycleLivePreview(
          cycle.school_id, cycle.id, report.student_id
        );
        expect(live).not.toBeNull();
        expect(withoutGenerationTime(live!.snapshot)).toEqual(
          withoutGenerationTime(snapshot)
        );

        const action = await getClassReportCycleEmailPreviewAction({
          batchId: cycle.id,
          studentId: report.student_id,
          locale: 'en'
        });
        expect(action.ok).toBe(true);
        if (!action.ok) continue;
        expect(action.preview.recipients).toEqual([]);
        expect(action.preview.subject).toBe(renderReportEmailSubject(snapshot));
        expect(action.preview.html).toBe(renderReportEmail(snapshot));

        const reportBody = htmlText(renderStudentReportV2(snapshot, 'both'));
        const emailBody = htmlText(action.preview.html);
        for (const section of snapshot.sections) {
          sectionsChecked++;
          for (const body of [reportBody, emailBody]) {
            assertVisibleText(body, section.approvedProgressEn);
            assertVisibleText(body, section.approvedProgressAr);
            if (snapshot.template.studentCommentsEnabled !== false) {
              assertVisibleText(body, section.commentEn);
              assertVisibleText(body, section.commentAr);
            }
          }
        }
        reportsChecked++;
      }

      for (const override of (overrides ?? []) as SavedOverride[]) {
        studentOverrides++;
        const approval = approvals.find((a) => a.id === override.approval_id);
        expect(approval).toBeDefined();
        const sources = workspace!.sources.filter((s) =>
          approval!.selectedSourceIds.includes(s.id) &&
          s.classSubjectId === approval!.classSubjectId &&
          s.subjectGroupId === approval!.subjectGroupId
        );
        const eligible = activeStudentIds.has(override.student_id) &&
          eligibleReportSourcesForStudent({
            studentId: override.student_id,
            classSubjectId: approval!.classSubjectId,
            subjectGroupId: approval!.subjectGroupId,
            reportStart: workspace!.batch.periodStart,
            reportEnd: workspace!.batch.periodEnd,
            sources,
            enrollments,
            memberships,
            exclusions
          }).length > 0;
        if (!eligible) {
          if (override.attendance_attended !== null &&
              override.attendance_total !== null) excludedAttendance++;
          continue;
        }
        const snapshot = byStudent.get(override.student_id);
        expect(snapshot).toBeDefined();
        const sections = snapshot!.sections.filter((section) =>
          section.classSubjectId === approval!.classSubjectId &&
          sources.some((source) => source.groupNameEn === section.groupNameEn)
        );
        expect(sections).toHaveLength(1);
        const section = sections[0]!;

        if (override.attendance_attended !== null &&
            override.attendance_total !== null) {
          expect(section.attendance.present).toBe(override.attendance_attended);
          expect(section.attendance.sessions).toBe(override.attendance_total);
          attendanceChecked++;
        }
        for (const [flag, actual, expected] of [
          [override.progress_en_overridden, section.approvedProgressEn, override.progress_en],
          [override.progress_ar_overridden, section.approvedProgressAr, override.progress_ar]
        ] as const) {
          if (flag) {
            expect(actual).toBe(expected);
            explicitFieldsChecked++;
          }
        }
        if (override.performance_overridden) {
          expect(section.performance).toBe(override.performance);
          explicitFieldsChecked++;
        }
        // The final comment may also contain a shared Admin comment. The
        // student's deliberate edit/clear must never revive a Teacher comment.
        for (const [flag, rendered, expected] of [
          [override.comment_en_overridden, section.commentEn, override.comment_en],
          [override.comment_ar_overridden, section.commentAr, override.comment_ar]
        ] as const) {
          if (flag && expected !== null) {
            expect(rendered).toContain(expected);
            explicitFieldsChecked++;
          }
        }
      }
    }

    expect(attendanceChecked + excludedAttendance).toBe(87);
    expect(studentOverrides).toBeGreaterThanOrEqual(87);
    // Only aggregate statistics go to the terminal; never print school data.
    console.log('PASS: 3 cycles; reports=' + reportsChecked +
      '; report sections=' + sectionsChecked +
      '; eligible attendance pairs=' + attendanceChecked +
      '; out-of-eligibility historical pairs=' + excludedAttendance +
      '; checked explicit Admin fields=' + explicitFieldsChecked);
  });
});
