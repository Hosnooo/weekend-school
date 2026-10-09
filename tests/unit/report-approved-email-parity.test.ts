import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

import {renderReportEmail} from '@/features/email/report-email';
import {resolveReportCommentOverride} from '@/features/reports/report-comment-override';
import {renderStudentReportV2} from '@/features/reports/report.renderer';
import {buildReportSnapshotV2} from '@/features/reports/report.service';

const approvedReport = () => buildReportSnapshotV2({
  school: {nameEn: 'Weekend School', nameAr: 'مدرسة نهاية الأسبوع'},
  student: {id: 'student-1', nameEn: 'Student A', nameAr: 'الطالب أ'},
  class: {id: 'class-1', nameEn: 'Class One', nameAr: 'الصف الأول'},
  period: {start: '2026-09-01', end: '2026-09-30'},
  language: 'both' as const,
  generatedAt: '2026-10-09T00:00:00Z',
  template: {
    performanceEnabled: true,
    studentCommentsEnabled: true,
    mainReportLabelEn: 'Approved progress',
    mainReportLabelAr: 'التقدم المعتمد'
  },
  sections: [
    {
      classSubjectId: 'subject-shared',
      subjectNameEn: 'Quran',
      subjectNameAr: 'القرآن',
      groupNameEn: 'Group One',
      groupNameAr: 'المجموعة الأولى',
      approvedProgressEn: 'Approved for Group One',
      approvedProgressAr: 'معتمد للمجموعة الأولى',
      performance: null,
      attendance: {present: 4, absent: 2, sessions: 6},
      commentEn: 'Administrator note One',
      commentAr: 'ملاحظة الإدارة الأولى',
      sourceTeacherNames: ['Teacher private identity'],
      unresolvedAttendanceConflicts: 0
    },
    {
      classSubjectId: 'subject-shared',
      subjectNameEn: 'Quran',
      subjectNameAr: 'القرآن',
      groupNameEn: 'Group Two',
      groupNameAr: 'المجموعة الثانية',
      approvedProgressEn: 'Approved for Group Two',
      approvedProgressAr: 'معتمد للمجموعة الثانية',
      performance: 'GOOD' as const,
      attendance: {present: 2, absent: 4, sessions: 6},
      commentEn: null,
      commentAr: null,
      sourceTeacherNames: ['Another private Teacher'],
      unresolvedAttendanceConflicts: 0
    }
  ]
});

describe('approved report snapshot and guardian email parity', () => {
  it('renders approved bilingual values and distinct same-subject groups in both outputs', () => {
    const {snapshot, issues} = approvedReport();
    expect(issues).toEqual([]);
    expect(snapshot).not.toBeNull();
    const report = renderStudentReportV2(snapshot!, 'both');
    const email = renderReportEmail(snapshot!);
    for (const output of [report, email]) {
      for (const expected of [
        'Group One',
        'Group Two',
        'Approved for Group One',
        'Approved for Group Two',
        'معتمد للمجموعة الأولى',
        'معتمد للمجموعة الثانية',
        'Attendance: 4 of 6 sessions',
        'Attendance: 2 of 6 sessions',
        'Administrator note One',
        'ملاحظة الإدارة الأولى'
      ]) expect(output).toContain(expected);
      expect(output).not.toContain('Teacher private identity');
      expect(output).not.toContain('Another private Teacher');
    }
  });

  it('honors intentionally omitted ratings and hidden comments in report and email', () => {
    const {snapshot} = approvedReport();
    expect(snapshot).not.toBeNull();
    const omitted = {
      ...snapshot!,
      template: {...snapshot!.template, studentCommentsEnabled: false},
      sections: snapshot!.sections.map((section) => ({...section, performance: null}))
    };
    for (const output of [
      renderStudentReportV2(omitted, 'both'),
      renderReportEmail(omitted)
    ]) {
      expect(output).not.toContain('<h3>Performance</h3>');
      expect(output).not.toContain('<h3>الأداء</h3>');
      expect(output).not.toContain('Administrator note One');
      expect(output).not.toContain('ملاحظة الإدارة الأولى');
      expect(output).toContain('Attendance: 4 of 6 sessions');
    }
  });

  it('keeps inherited Teacher comments until the Administrator intentionally changes them', () => {
    const base = {
      visible: true,
      wasOverridden: false,
      currentComment: 'Teacher original',
      submittedComment: 'Teacher original'
    };
    expect(resolveReportCommentOverride(base)).toBe(false);
    expect(resolveReportCommentOverride({...base, submittedComment: 'Admin correction'})).toBe(true);
    expect(resolveReportCommentOverride({...base, submittedComment: null})).toBe(true);
    expect(resolveReportCommentOverride({...base, wasOverridden: true, submittedComment: null})).toBe(true);
    expect(resolveReportCommentOverride({...base, visible: false, submittedComment: null})).toBe(false);
    expect(resolveReportCommentOverride({...base, currentComment: null, submittedComment: null})).toBe(false);
  });

  it('persists explicit per-language comment flags rather than enabling override for all visible comments', () => {
    const sql = readFileSync(
      'supabase/migrations/20261009091000_admin_approved_reports_atomic.sql',
      'utf8'
    );
    const action = readFileSync(
      'src/features/reports/class-report-review.actions.ts',
      'utf8'
    );
    expect(sql).toContain('comment_en_overridden boolean');
    expect(sql).toContain('comment_ar_overridden boolean');
    expect(sql).toContain('coalesce(v_student.comment_en_overridden, false)');
    expect(sql).toContain('coalesce(v_student.comment_ar_overridden, false)');
    expect(sql).not.toContain('v_existing.comment_en_overridden\n          or coalesce(p_include_student_comments, false)');
    expect(sql).not.toContain('v_existing.comment_ar_overridden\n          or coalesce(p_include_student_comments, false)');
    expect(action).toContain('resolveReportCommentOverride');
    expect(action).toContain('comment_en_overridden:');
    expect(action).toContain('comment_ar_overridden:');
  });
});
