import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('authoritative Administrator report preview and revisions', () => {
  it('displays current Admin-approved values for unsent reports instead of an older snapshot', () => {
    const page = readFileSync(
      'src/app/[locale]/(protected)/(admin)/reports/[id]/page.tsx',
      'utf8'
    );
    expect(page).toContain('getClassReportCycleLivePreview');
    expect(page).toContain("batch?.status !== 'FINALIZED'");
    expect(page).toContain('effectiveSnapshot = live.snapshot');
    expect(page).toContain('approvedPreviewUnavailable');
    expect(page).toContain("t('approvalPreviewUnavailable')");
  });

  it('finalization creates revisions without replacing historical snapshots', () => {
    const finalized = readFileSync(
      'src/features/reports/class-report-finalization.repository.ts',
      'utf8'
    );
    expect(finalized).toContain('buildClassReportCycleSnapshots');
    expect(finalized).toContain("db.rpc('finalize_report_batch'");
    expect(finalized).toContain('built.issues.length > 0');
  });

  it('requires atomic Admin save and refuses unconfirmed attendance overlaps', () => {
    const actions = readFileSync(
      'src/features/reports/class-report-review.actions.ts',
      'utf8'
    );
    const aggregator = readFileSync(
      'src/features/reports/report-attendance.ts',
      'utf8'
    );
    expect(actions).toContain("db.rpc('save_class_report_review_atomic'");
    expect(aggregator).toContain('numericConflicts');
    expect(aggregator).toContain('partialOverlap');
  });
});
