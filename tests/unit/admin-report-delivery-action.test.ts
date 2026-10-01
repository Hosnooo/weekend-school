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

  it('generates one content-driven report per student instead of one per guardian language', () => {
    const source = readFileSync(
      'src/features/reports/report-batch.repository.ts',
      'utf8'
    );

    expect(source).toContain("language: 'both'");
    expect(source).not.toContain('for (const language of languages)');
  });
});
