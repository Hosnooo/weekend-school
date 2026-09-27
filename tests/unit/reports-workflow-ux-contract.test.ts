import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Reports workflow UX', () => {
  it('uses a progressive page instead of fake stage tabs', () => {
    const page = source(
      'src/app/[locale]/(protected)/(admin)/reports/page.tsx'
    );

    expect(page).not.toContain("import {Tabs}");
    expect(page).not.toContain('<Tabs');
    expect(page).toContain('ReportStudentReviewTable');
    expect(page).toContain("t('studentReview')");
  });

  it('shows teacher sources as readable cards instead of dead form controls', () => {
    const composer = source(
      'src/features/reports/report-composer.tsx'
    );

    expect(composer).toContain('report-source-card');
    expect(composer).not.toContain('type="checkbox"');
    expect(composer).not.toContain('report-custom-progress-en');
    expect(composer).not.toContain('report-custom-progress-ar');
  });

  it('automatically approves a single submitted source when preparing a batch', () => {
    const actions = source('src/features/reports/report.actions.ts');

    expect(actions).toContain('getReportBatchWorkspace');
    expect(actions).toContain('workspace?.sources.length === 1');
    expect(actions).toContain(
      'approveAllSubmittedSources(profile.schoolId, batchId)'
    );
  });
});
