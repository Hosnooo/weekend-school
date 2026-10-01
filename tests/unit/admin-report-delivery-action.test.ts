import {existsSync, readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('admin report delivery action', () => {
  it('sends only the ready or failed reports for one batch', () => {
    const path =
      'src/features/reports/admin-report-delivery.actions.ts';

    expect(existsSync(path)).toBe(true);

    const source = readFileSync(path, 'utf8');

    expect(source).toContain(
      'sendAdminReportBatchAction'
    );
    expect(source).toContain("eq('batch_id'");
    expect(source).toContain("'READY'");
    expect(source).toContain("'FAILED'");
    expect(source).toContain('sendReportDeliveries');
  });

  it('delivers a report to every active linked guardian who receives reports', () => {
    const source = readFileSync(
      'src/features/email/email.repository.ts',
      'utf8'
    );

    expect(source).toContain("eq('receives_reports', true)");
    expect(source).toContain("eq('guardians.is_active', true)");
    expect(source).not.toContain("eq('guardians.report_language', report.language)");
  });

  it('generates one content-driven report per student for Class Report Cycles', () => {
    const finalizer = readFileSync(
      'src/features/reports/class-report-finalization.repository.ts',
      'utf8'
    );
    const actions = readFileSync(
      'src/features/reports/admin-report-workflow.actions.ts',
      'utf8'
    );

    expect(finalizer).toContain("language: 'both'");
    expect(finalizer).toContain('finalizeClassReportCycleReports');
    expect(finalizer).not.toContain('guardian.report_language');
    expect(actions).toContain('finalizeClassReportCycleReports');
    expect(actions).not.toContain('approveAllSubmittedSources');
  });
});
