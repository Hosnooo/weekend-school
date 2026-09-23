import {describe, expect, it} from 'vitest';

import {exportRequestSchema} from '@/features/exports/export.schemas';
import {renderStudentReport} from '@/features/reports/report.renderer';
import type {ReportSnapshotV2} from '@/features/reports/report.types';
import {inviteTeacher, type TeacherInvitationDependencies} from '@/features/teachers/teacher.service';

const invitationInput = {
  schoolId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Existing Teacher',
  email: 'existing@example.com',
  preferredLanguage: 'en' as const,
  assignedGroupIds: [] as string[]
};

describe('redesign regressions', () => {
  it('checks for an existing unclaimed Auth identity before attempting a new invitation', async () => {
    const calls: string[] = [];
    const dependencies: TeacherInvitationDependencies = {
      async validateAssignments() {},
      async inviteAuthUser() {
        calls.push('invite');
        throw new Error('email_exists');
      },
      async createProfile() { return 'profile-existing'; },
      async assignGroups() {},
      async deleteProfile() {},
      async deleteAuthUser() {},
      async findUnclaimedAuthUser() {
        calls.push('lookup');
        return 'auth-existing';
      },
      async sendExistingAccessLink() {}
    };

    await expect(inviteTeacher(invitationInput, dependencies)).resolves.toBe('profile-existing');
    expect(calls[0]).toBe('lookup');
    expect(calls).not.toContain('invite');
  });

  it('accepts every approved export dataset', () => {
    const result = exportRequestSchema.safeParse({
      period: {kind: 'ALL'},
      scope: {type: 'SCHOOL', id: null},
      datasets: [
        'ATTENDANCE',
        'SUBMISSIONS',
        'PERFORMANCE',
        'COMMENTS',
        'REPORTS',
        'ENROLLMENT_HISTORY',
        'TEACHER_ASSIGNMENTS'
      ]
    });
    expect(result.success).toBe(true);
  });

  it('renders the subject-aware v2 parent report without legacy attendance categories', () => {
    const snapshot: ReportSnapshotV2 = {
      version: 2,
      school: {nameEn: 'MCE Weekend School', nameAr: 'مدرسة MCE لعطلة نهاية الأسبوع'},
      student: {id: 's1', nameEn: 'Student One', nameAr: null},
      class: {id: 'c1', nameEn: 'Class 5', nameAr: null},
      period: {start: '2026-09-01', end: '2026-09-30'},
      language: 'en',
      sections: [{
        classSubjectId: 'cs1',
        subjectNameEn: 'Quran',
        subjectNameAr: null,
        groupNameEn: 'Group A',
        groupNameAr: null,
        approvedProgressEn: 'Completed Surah review.',
        approvedProgressAr: null,
        performance: 'GOOD',
        attendance: {present: 3, absent: 1, sessions: 4},
        commentEn: 'Good participation.',
        commentAr: null
      }],
      template: {introEn: 'Monthly update', introAr: null, closingEn: 'Thank you.', closingAr: null},
      author: 'MCE Weekend School',
      generatedAt: '2026-09-30T12:00:00.000Z'
    };

    const html = renderStudentReport(snapshot as never, 'en');
    expect(html).toContain('Quran');
    expect(html).toContain('MCE Weekend School');
    expect(html).not.toContain('Late');
    expect(html).not.toContain('Excused');
  });
});
