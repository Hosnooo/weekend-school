import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('reversible Teacher and Admin report workflow', () => {
  it('lets Teachers reopen submitted weekly work', () => {
    const actions = read(
      'src/features/weekly-updates/weekly-update.actions.ts'
    );
    const repository = read(
      'src/features/weekly-updates/weekly-update.repository.ts'
    );
    const history = read(
      'src/app/[locale]/(protected)/(teacher)/history/[id]/page.tsx'
    );

    expect(actions).toContain('reopenWeeklySubmissionAction');
    expect(repository).toContain('reopenWeeklySubmission');
    expect(repository).toContain("'reopen_weekly_submission'");
    expect(history).toContain('reopenWeeklySubmissionAction');
    expect(history).toContain("t('reopenAndEdit')");
  });

  it('removes the Admin Review lock before finalization', () => {
    const reports = read(
      'src/app/[locale]/(protected)/(admin)/reports/page.tsx'
    );
    const repository = read(
      'src/features/reports/report-batch.repository.ts'
    );

    expect(reports).not.toContain('reviewReportBatchAction');
    expect(reports).not.toContain("t('moveToReview')");
    expect(reports).toContain("t('refreshSources')");
    expect(reports).toContain('finalizeReportBatchAction');

    expect(repository).not.toContain(
      "workspace.batch.status !== 'REVIEW'"
    );
  });
});
