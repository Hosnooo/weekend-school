import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();

function exists(path: string) {
  return existsSync(resolve(root, path));
}

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('flexible Teaching Update application contract', () => {
  const featureRoot = 'src/features/teaching-updates';

  it('introduces a Teaching Update application model over the legacy weekly storage', () => {
    const typesPath = `${featureRoot}/teaching-update.types.ts`;
    const schemasPath = `${featureRoot}/teaching-update.schemas.ts`;

    expect(exists(typesPath), `${typesPath} should exist`).toBe(true);
    expect(exists(schemasPath), `${schemasPath} should exist`).toBe(true);

    if (!exists(typesPath) || !exists(schemasPath)) return;

    const types = source(typesPath);
    const schemas = source(schemasPath);

    expect(types).toContain("'OPEN'");
    expect(types).toContain("'SUBMITTED'");
    expect(types).toContain("'DISMISSED'");
    expect(types).toContain("'RANGE'");
    expect(types).toContain("'DATES'");
    expect(types).toContain('version');

    expect(schemas).toContain("z.enum(['RANGE', 'DATES'])");
    expect(schemas).toContain('periodStart');
    expect(schemas).toContain('periodEnd');
    expect(schemas).toContain('dates');
  });

  it('adds an atomic Teacher draft mutation while reusing Task 1 lifecycle RPCs', () => {
    const migrationPath =
      'supabase/migrations/20260927222000_teaching_update_mutations.sql';
    const repositoryPath =
      `${featureRoot}/teaching-update.repository.ts`;

    expect(
      exists(migrationPath),
      `${migrationPath} should exist`
    ).toBe(true);

    expect(
      exists(repositoryPath),
      `${repositoryPath} should exist`
    ).toBe(true);

    if (!exists(migrationPath) || !exists(repositoryPath)) return;

    const migration = source(migrationPath);
    const repository = source(repositoryPath);

    expect(migration).toContain(
      'create or replace function public.save_teaching_update_draft'
    );
    expect(migration).toContain('weekly_submission_dates');
    expect(migration).toContain('p_coverage_kind');
    expect(migration).toContain('p_period_start');
    expect(migration).toContain('p_period_end');
    expect(migration).toContain('p_dates');
    expect(migration).toContain('p_expected_version');

    expect(repository).toContain(
      "'save_teaching_update_draft'"
    );
    expect(repository).toContain(
      "'find_overlapping_teaching_updates'"
    );
    expect(repository).toContain(
      "'submit_teaching_update'"
    );
    expect(repository).toContain(
      "'dismiss_teaching_update'"
    );
  });

  it('replaces week-only Teacher editing with RANGE or exact DATES coverage', () => {
    const editorPath =
      `${featureRoot}/teaching-update-editor.tsx`;

    expect(
      exists(editorPath),
      `${editorPath} should exist`
    ).toBe(true);

    if (!exists(editorPath)) return;

    const editor = source(editorPath);

    expect(editor).toContain('name="coverageKind"');
    expect(editor).toContain('name="periodStart"');
    expect(editor).toContain('name="periodEnd"');
    expect(editor).toContain('name="dates"');

    expect(editor).toContain("value=\"RANGE\"");
    expect(editor).toContain("value=\"DATES\"");

    expect(editor).toContain('overlap');
    expect(editor).toContain('canSubmit');
    expect(editor).toContain('DISMISSED');

    expect(editor).not.toContain('name="weekStart"');
  });

  it('opens Teacher updates by submission identity instead of a synthetic week key', () => {
    const pagePath =
      'src/app/[locale]/(protected)/(teacher)/my-teaching/update/page.tsx';

    const page = source(pagePath);

    expect(page).toContain('submissionId');
    expect(page).toContain('getTeachingUpdate');
    expect(page).toContain('TeachingUpdateEditor');

    expect(page).not.toContain('query.week');
    expect(page).not.toContain('getWeeklySubmission(');
    expect(page).not.toContain('WeeklyUpdateForm');
  });

  it('exposes create/edit Teaching Update actions from My Teaching', () => {
    const actionsPath =
      `${featureRoot}/teaching-update.actions.ts`;
    const myTeachingPath =
      'src/app/[locale]/(protected)/(teacher)/my-teaching/page.tsx';
    const taskListPath =
      `${featureRoot}/teaching-update-task-list.tsx`;

    expect(
      exists(actionsPath),
      `${actionsPath} should exist`
    ).toBe(true);

    expect(
      exists(taskListPath),
      `${taskListPath} should exist`
    ).toBe(true);

    if (!exists(actionsPath) || !exists(taskListPath)) return;

    const actions = source(actionsPath);
    const myTeaching = source(myTeachingPath);
    const taskList = source(taskListPath);

    expect(actions).toContain(
      'saveTeachingUpdateDraftAction'
    );
    expect(actions).toContain(
      'submitTeachingUpdateAction'
    );
    expect(actions).toContain(
      'dismissTeachingUpdateAction'
    );

    expect(myTeaching).toContain('TeachingUpdateTaskList');
    expect(taskList).toContain('submissionId');
  });

  it('keeps overlaps informational rather than blocking creation', () => {
    const repositoryPath =
      `${featureRoot}/teaching-update.repository.ts`;
    const editorPath =
      `${featureRoot}/teaching-update-editor.tsx`;

    if (!exists(repositoryPath) || !exists(editorPath)) return;

    const repository = source(repositoryPath);
    const editor = source(editorPath);

    expect(repository).toContain(
      'findOverlappingTeachingUpdates'
    );
    expect(editor).toContain('overlap');

    expect(editor).not.toContain(
      'disabled={overlaps.length > 0}'
    );
  });

  it('keeps shared Admin-requested OPEN items visible to assigned Teachers', () => {
    const repository = source(
      'src/features/teaching-updates/teaching-update.repository.ts'
    );

    expect(repository).toContain(
      'listOpenTeachingUpdates'
    );

    const openList = repository.slice(repository.indexOf('export async function listOpenTeachingUpdates'));
    expect(openList).not.toContain(
      ".in('teacher_id', teacherIds)"
    );
  });

});
