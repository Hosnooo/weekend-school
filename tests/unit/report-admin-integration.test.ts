import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();
const reportPage = readFileSync(resolve(root, 'src/app/[locale]/(protected)/(admin)/reports/page.tsx'), 'utf8');
const reportActions = readFileSync(resolve(root, 'src/features/reports/report.actions.ts'), 'utf8');
const reportBatchRepository = readFileSync(resolve(root, 'src/features/reports/report-batch.repository.ts'), 'utf8');

describe('subject-aware report admin integration', () => {
  it('wires the composer and batch summary into the reports page', () => {
    expect(reportPage).toContain('ReportComposer');
    expect(reportPage).toContain('ReportBatchSummary');
    expect(reportPage).toContain('prepareReportBatchAction');
    expect(reportPage).toContain('finalizeReportBatchAction');
  });

  it('provides persistent batch workflow actions and repository adapters', () => {
    expect(reportActions).toContain('prepareReportBatchAction');
    expect(reportActions).toContain('reviewReportBatchAction');
    expect(reportActions).toContain('finalizeReportBatchAction');
    expect(reportBatchRepository).toContain('createReportBatch');
    expect(reportBatchRepository).toContain('getReportBatchWorkspace');
    expect(reportBatchRepository).toContain('finalizeReportBatch');
  });
});
