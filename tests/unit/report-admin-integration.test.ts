import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();
const reportPage = readFileSync(
  resolve(
    root,
    'src/app/[locale]/(protected)/(admin)/reports/page.tsx'
  ),
  'utf8'
);
const reportWorkspacePage = readFileSync(
  resolve(
    root,
    'src/app/[locale]/(protected)/(admin)/reports/workspace/[batchId]/page.tsx'
  ),
  'utf8'
);
const reportActions = readFileSync(
  resolve(root, 'src/features/reports/report.actions.ts'),
  'utf8'
);
const reportBatchRepository = readFileSync(
  resolve(root, 'src/features/reports/report-batch.repository.ts'),
  'utf8'
);

describe('subject-aware report admin integration', () => {
  it('wires the context-driven Admin reporting workspace', () => {
    expect(reportPage).toContain('listAdminReportContexts');
    expect(reportWorkspacePage).toContain('getAdminReportWorkspace');
    expect(reportPage).toContain('openAdminReportContextAction');
    expect(reportWorkspacePage).toContain('saveAdminReportWorkspaceAction');
    expect(reportWorkspacePage).toContain('finalizeAdminReportWorkspaceAction');
    expect(reportWorkspacePage).toContain('AttendanceConflictList');

    expect(reportPage).not.toContain('ReportComposer');
    expect(reportPage).not.toContain('ReportBatchSummary');
    expect(reportPage).not.toContain('prepareReportBatchAction');
  });

  it('retains the persistent batch workflow internals', () => {
    expect(reportActions).toContain('prepareReportBatchAction');
    expect(reportActions).toContain('reviewReportBatchAction');
    expect(reportActions).toContain('finalizeReportBatchAction');
    expect(reportBatchRepository).toContain('createReportBatch');
    expect(reportBatchRepository).toContain('getReportBatchWorkspace');
    expect(reportBatchRepository).toContain('finalizeReportBatch');
  });
});
