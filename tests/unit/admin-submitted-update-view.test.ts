import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('Administrator submitted Teaching Update viewing', () => {
  const page = readFileSync(
    'src/app/[locale]/(protected)/(admin)/teaching-updates/[id]/page.tsx',
    'utf8'
  );
  const list = readFileSync(
    'src/features/teaching-updates/admin-teaching-updates-workspace.tsx',
    'utf8'
  );

  it('offers direct view of submitted Teacher source without reopening it', () => {
    expect(list).toContain("update.status === 'SUBMITTED'");
    expect(list).toContain('viewSubmitted');
    expect(list).toContain('href={`/teaching-updates/${update.id}`}');
    expect(page).toContain("requireProfile(locale, 'ADMIN')");
    expect(page).toContain("submission.status !== 'SUBMITTED'");
    expect(page).not.toContain('reopenAdminTeachingUpdateAction');
  });

  it('keeps the original Teacher source read-only and separate', () => {
    expect(page).toContain('teacherSourceAudit');
    expect(page).toContain('submission.progressEn');
    expect(page).toContain('submission.progressAr');
    expect(page).not.toMatch(/<form[^>]*action/);
  });

  it('isolates linked approvals to school, exact subject and group', () => {
    expect(page).toContain(".eq('school_id', profile.schoolId)");
    expect(page).toContain(".eq('weekly_submission_id', id.data)");
    expect(page).toContain('approval.class_subject_id === submission.classSubjectId');
    expect(page).toContain('approval.subject_group_id === submission.subjectGroupId');
    expect(page).toContain('approval.batch_id');
  });

  it('keeps report review and edits inside the linked cycle', () => {
    expect(page).toContain('viewCycleReport');
    expect(page).toContain('editCycleReport');
    expect(page).toContain("cycle.status !== 'FINALIZED'");
    expect(page).toContain('approval.approved_progress_en');
    expect(page).toContain('approval.approved_progress_ar');
    expect(page).toContain('row.attendance_attended');
    expect(page).toContain('row.attendance_total');
  });
});
