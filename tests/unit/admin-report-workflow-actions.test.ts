import {existsSync, readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('admin report workflow actions', () => {
  it('provides context-open, save, finalize and reopen actions', () => {
    const path =
      'src/features/reports/admin-report-workflow.actions.ts';

    expect(existsSync(path)).toBe(true);

    const source = readFileSync(path, 'utf8');

    expect(source).toContain(
      'openAdminReportContextAction'
    );
    expect(source).toContain(
      'saveAdminReportWorkspaceAction'
    );
    expect(source).toContain(
      'finalizeAdminReportWorkspaceAction'
    );
    expect(source).toContain(
      'reopenAdminReportWorkspaceAction'
    );
  });
});
