import {
  existsSync,
  readFileSync
} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();

function exists(path: string) {
  return existsSync(resolve(root, path));
}

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

const paths = {
  page:
    'src/app/[locale]/(protected)/(admin)/teaching-updates/page.tsx',
  repository:
    'src/features/teaching-updates/admin-teaching-update.repository.ts',
  actions:
    'src/features/teaching-updates/admin-teaching-update.actions.ts',
  types:
    'src/features/teaching-updates/admin-teaching-update.types.ts',
  navigation:
    'src/lib/auth/navigation.ts',
  en: 'messages/en.json',
  ar: 'messages/ar.json'
} as const;

describe('Admin Teaching Updates contract', () => {
  it('provides a first-class administrator Teaching Updates route', () => {
    expect(exists(paths.page), paths.page).toBe(true);
    if (!exists(paths.page)) return;

    const page = source(paths.page);

    expect(page).toContain("requireProfile(locale, 'ADMIN')");
    expect(page).toContain('listAdminTeachingUpdates');
    expect(page).toContain('listAdminTeachingUpdateRequestSets');
    expect(page).toContain('listAdminTeachingUpdateContexts');
    expect(page).toContain('AdminTeachingUpdatesWorkspace');

    const workspacePath =
      'src/features/teaching-updates/admin-teaching-updates-workspace.tsx';
    const requestDialogPath =
      'src/features/teaching-updates/request-teaching-update-dialog.tsx';

    expect(exists(workspacePath), workspacePath).toBe(true);
    expect(exists(requestDialogPath), requestDialogPath).toBe(true);

    const workspace = source(workspacePath);
    const requestDialog = source(requestDialogPath);

    expect(requestDialog).toContain('requestAdminTeachingUpdateAction');
    expect(workspace).toContain('reopenAdminTeachingUpdateAction');
    expect(workspace).toContain('dismissAdminTeachingUpdateAction');
  });

  it('lists Teacher-created and Admin-requested updates with operational audit data', () => {
    expect(exists(paths.repository), paths.repository).toBe(true);
    if (!exists(paths.repository)) return;

    const repository = source(paths.repository);

    expect(repository).toContain(
      'function listAdminTeachingUpdates'
    );

    for (const field of [
      'teacher_id',
      'request_set_id',
      'coverage_kind',
      'period_start',
      'period_end',
      'status',
      'created_by_profile_id',
      'requested_by_profile_id',
      'admin_note',
      'dismissed_at',
      'dismissed_by_profile_id',
      'dismissal_reason',
      'version',
      'created_at',
      'updated_at'
    ]) {
      expect(repository).toContain(field);
    }

    expect(repository).toContain('weekly_submissions');
    expect(repository).toContain('weekly_submission_dates');
    expect(repository).toContain('teachers');
    expect(repository).toContain('listEnrollmentClasses');
  });

  it('summarizes each Admin request set and preserves its snapshotted items', () => {
    expect(exists(paths.repository), paths.repository).toBe(true);
    expect(exists(paths.types), paths.types).toBe(true);

    if (
      !exists(paths.repository) ||
      !exists(paths.types)
    ) {
      return;
    }

    const repository = source(paths.repository);
    const types = source(paths.types);

    expect(repository).toContain(
      'function listAdminTeachingUpdateRequestSets'
    );
    expect(repository).toContain(
      'teaching_update_request_sets'
    );
    expect(repository).toContain('request_set_id');

    for (const field of [
      'totalCount',
      'submittedCount',
      'openCount',
      'dismissedCount'
    ]) {
      expect(types).toContain(field);
    }

    // Completion is derived from the original request-set items.
    // The UI must not recalculate the set from current Groups.
    expect(repository).not.toContain(
      'rebuildRequestSetFromCurrentGroups'
    );
  });

  it('uses the existing Task 1 request, reopen, and dismiss RPCs', () => {
    expect(exists(paths.actions), paths.actions).toBe(true);
    if (!exists(paths.actions)) return;

    const actions = source(paths.actions);

    for (const actionName of [
      'requestAdminTeachingUpdateAction',
      'reopenAdminTeachingUpdateAction',
      'dismissAdminTeachingUpdateAction'
    ]) {
      expect(actions).toContain(
        `function ${actionName}`
      );
    }

    expect(actions).toContain("requireProfile(locale, 'ADMIN')");

    for (const rpc of [
      'request_teaching_update',
      'reopen_weekly_submission',
      'dismiss_teaching_update'
    ]) {
      expect(actions).toContain(`'${rpc}'`);
    }

    expect(actions).toContain('/teaching-updates');
  });

  it('supports useful Admin filters without changing source history', () => {
    const workspacePath =
      'src/features/teaching-updates/admin-teaching-updates-workspace.tsx';

    expect(exists(workspacePath), workspacePath).toBe(true);
    if (!exists(workspacePath)) return;

    const workspace = source(workspacePath);

    expect(workspace).toContain('StatusFilter');
    expect(workspace).toContain('SourceFilter');
    expect(workspace).toContain("'ALL'");
    expect(workspace).toContain("'OPEN'");
    expect(workspace).toContain("'SUBMITTED'");
    expect(workspace).toContain("'DISMISSED'");
    expect(workspace).toContain('value="TEACHER"');
    expect(workspace).toContain('value="ADMIN_REQUEST"');
  });

  it('shows request creation for RANGE and exact DATES coverage', () => {
    const dialogPath =
      'src/features/teaching-updates/request-teaching-update-dialog.tsx';

    expect(exists(dialogPath), dialogPath).toBe(true);
    if (!exists(dialogPath)) return;

    const dialog = source(dialogPath);

    expect(dialog).toContain('classSubjectId');
    expect(dialog).toContain('coverageKind');
    expect(dialog).toContain("'RANGE'");
    expect(dialog).toContain("'DATES'");
    expect(dialog).toContain('periodStart');
    expect(dialog).toContain('periodEnd');
    expect(dialog).toContain('dates');
    expect(dialog).toContain('adminNote');
  });

  it('adds Teaching Updates to translated Admin School navigation', () => {
    expect(exists(paths.navigation), paths.navigation).toBe(true);

    const navigation = source(paths.navigation);
    const en = JSON.parse(source(paths.en));
    const ar = JSON.parse(source(paths.ar));

    expect(navigation).toContain('/teaching-updates');

    const enText = JSON.stringify(en);
    const arText = JSON.stringify(ar);

    expect(enText).toContain('Teaching Updates');
    expect(arText).toContain('تحديثات');
  });

  it('keeps Teaching Updates as source operations separate from parent Reports', () => {
    expect(exists(paths.page), paths.page).toBe(true);
    if (!exists(paths.page)) return;

    const page = source(paths.page);

    expect(page).not.toContain('finalizeReportBatch');
    expect(page).not.toContain('sendReport');
    expect(page).not.toContain('report_section_sources');
  });
});
