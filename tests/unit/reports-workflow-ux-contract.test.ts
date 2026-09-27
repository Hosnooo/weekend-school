import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Reports workflow UX', () => {
  it('uses one status-driven context page instead of staged controls', () => {
    const page = source(
      'src/app/[locale]/(protected)/(admin)/reports/page.tsx'
    );

    expect(page).not.toContain("import {Tabs}");
    expect(page).not.toContain('<Tabs');
    expect(page).toContain('listAdminReportContexts');
    expect(page).toContain('getAdminReportWorkspace');
    expect(page).toContain('AttendanceConflictList');
    expect(page).toContain('finalizeAdminReportWorkspaceAction');

    expect(page).not.toContain('ReportStudentReviewTable');
    expect(page).not.toContain('prepareReportBatchAction');
    expect(page).not.toContain("name=\"scopeType\"");
  });

  it('keeps teacher-source internals readable rather than interactive dead controls', () => {
    const composer = source(
      'src/features/reports/report-composer.tsx'
    );

    expect(composer).toContain('report-source-card');
    expect(composer).not.toContain('type=\"checkbox\"');
    expect(composer).not.toContain('report-custom-progress-en');
    expect(composer).not.toContain('report-custom-progress-ar');
  });

  it('keeps single-source auto-approval available in the batch internals', () => {
    const actions = source('src/features/reports/report.actions.ts');

    expect(actions).toContain('getReportBatchWorkspace');
    expect(actions).toContain('workspace?.sources.length === 1');
    expect(actions).toContain(
      'approveAllSubmittedSources(profile.schoolId, batchId)'
    );
  });
});
