import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const root = process.cwd();

const listPath = join(
  root,
  'src/app/[locale]/(protected)/(admin)/reports/page.tsx'
);

const workspacePath = join(
  root,
  'src/app/[locale]/(protected)/(admin)/reports/workspace/[batchId]/page.tsx'
);

const actionsPath = join(
  root,
  'src/features/reports/admin-report-workflow.actions.ts'
);

describe('Admin Reports navigation', () => {
  it('uses a dedicated report workspace route', () => {
    expect(existsSync(workspacePath)).toBe(true);

    if (!existsSync(workspacePath)) return;

    const workspace = readFileSync(workspacePath, 'utf8');

    expect(workspace).toContain('getAdminReportWorkspace');
    expect(workspace).toContain('saveAdminReportWorkspaceAction');
    expect(workspace).toContain('finalizeAdminReportWorkspaceAction');
    expect(workspace).toContain('reopenAdminReportWorkspaceAction');
    expect(workspace).toContain('sendAdminReportBatchAction');
    expect(workspace).toContain('href={backHref}');
  });

  it('keeps the reports index as a compact queue only', () => {
    const page = readFileSync(listPath, 'utf8');

    expect(page).toContain('listAdminReportContexts');
    expect(page).toContain('className="table-wrap"');
    expect(page).toContain('<table');

    expect(page).not.toContain('getAdminReportWorkspace');
    expect(page).not.toContain('AttendanceConflictList');
    expect(page).not.toContain('saveAdminReportWorkspaceAction');
  });

  it('opens a report by navigating to its dedicated route', () => {
    const actions = readFileSync(actionsPath, 'utf8');

    expect(actions).toContain('/reports/');
  });

  it('offers delivery actions directly from the report queue', () => {
    const page = readFileSync(listPath, 'utf8');

    expect(page).toContain('sendAdminReportBatchAction');
    expect(page).toContain("'READY_TO_SEND'");
    expect(page).toContain("'DELIVERY_ISSUE'");
    expect(page).toContain('ConfirmSubmitButton');

    expect(
      existsSync(
        join(
          root,
          'src/components/ui/confirm-submit-button.tsx'
        )
      )
    ).toBe(true);
  });


});
