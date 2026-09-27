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
});
