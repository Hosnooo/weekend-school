import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('Teaching Updates usable workspace', () => {
  const adminPage =
    'src/app/[locale]/(protected)/(admin)/teaching-updates/page.tsx';
  const teacherPage =
    'src/app/[locale]/(protected)/(teacher)/my-teaching/page.tsx';

  it('keeps the Admin route thin and delegates interaction to one workspace', () => {
    expect(existsSync(resolve(root, adminPage))).toBe(true);

    const page = source(adminPage);

    expect(page).toContain('AdminTeachingUpdatesWorkspace');
    expect(page).not.toContain('<form');
    expect(page).not.toContain('requestSetBreakdown');
    expect(page).not.toContain('audit');
  });

  it('provides a focused Admin workspace instead of a wall of forms and cards', () => {
    const path =
      'src/features/teaching-updates/admin-teaching-updates-workspace.tsx';

    expect(existsSync(resolve(root, path))).toBe(true);

    if (!existsSync(resolve(root, path))) return;

    const workspace = source(path);

    expect(workspace).toContain('DataTable');
    expect(workspace).toContain('Badge');
    expect(workspace).toContain('Dialog');
    expect(workspace).toContain('summary');
    expect(workspace).toContain('RequestTeachingUpdateDialog');
    expect(workspace).toContain('TeachingUpdateDetails');
  });

  it('opens the request form only when the Admin chooses Request update', () => {
    const path =
      'src/features/teaching-updates/request-teaching-update-dialog.tsx';

    expect(existsSync(resolve(root, path))).toBe(true);

    if (!existsSync(resolve(root, path))) return;

    const dialog = source(path);

    expect(dialog).toContain('Dialog');
    expect(dialog).toContain('requestTeachingUpdateAction');
    expect(dialog).toContain('classSubjectId');
    expect(dialog).toContain('coverageKind');
    expect(dialog).toContain('adminNote');
  });

  it('shows Admin request progress compactly rather than as repeated explanatory prose', () => {
    const path =
      'src/features/teaching-updates/admin-teaching-updates-workspace.tsx';

    if (!existsSync(resolve(root, path))) return;

    const workspace = source(path);

    expect(workspace).toContain('<progress');
    expect(workspace).toContain("t('progress'");
    expect(workspace).not.toContain('requestHelp');
  });

  it('presents Teacher OPEN updates as actionable tasks', () => {
    expect(existsSync(resolve(root, teacherPage))).toBe(true);

    const page = source(teacherPage);

    expect(page).toContain('TeachingUpdateTaskList');
    expect(page).not.toContain('openUpdates.map');
  });

  it('gives each Teacher task one obvious continuation action and compact context', () => {
    const path =
      'src/features/teaching-updates/teaching-update-task-list.tsx';

    expect(existsSync(resolve(root, path))).toBe(true);

    if (!existsSync(resolve(root, path))) return;

    const list = source(path);

    expect(list).toContain('Badge');
    expect(list).toContain('continue');
    expect(list).toContain('adminRequest');
    expect(list).toContain('submissionId');
  });

  it('keeps EN/AR labels for the simplified workspace', () => {
    const en = JSON.parse(source('messages/en.json'));
    const ar = JSON.parse(source('messages/ar.json'));

    const required = [
      'requestUpdate',
      'summaryOpen',
      'summarySubmitted',
      'summaryDismissed',
      'summaryNeedsAttention',
      'filters',
      'details',
      'viewDetails'
    ];

    for (const key of required) {
      expect(en.adminTeachingUpdates[key]).toBeTruthy();
      expect(ar.adminTeachingUpdates[key]).toBeTruthy();
    }
  });
});
