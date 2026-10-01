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

describe('Class Report Cycle contract', () => {
  const repositoryPath =
    'src/features/reports/report-batch.repository.ts';

  const actionsPath =
    'src/features/reports/admin-report-workflow.actions.ts';

  const sourcesComponentPath =
    'src/features/reports/report-cycle-sources.tsx';

  const reportsPagePath =
    'src/app/[locale]/(protected)/(admin)/reports/page.tsx';

  const workspacePagePath =
    'src/app/[locale]/(protected)/(admin)/reports/workspace/[batchId]/page.tsx';

  it('exposes the approved Class Report Cycle application interfaces', () => {
    const repository = source(repositoryPath);

    expect(repository).toContain(
      'createClassReportCycle'
    );

    expect(repository).toContain(
      'listEligibleTeachingUpdateSources'
    );

    expect(repository).toContain(
      'setReportCycleSourceIncluded'
    );

    expect(repository).toContain(
      'getClassReportCycleWorkspace'
    );
  });

  it('creates new Report Cycles at Class scope', () => {
    const repository = source(repositoryPath);

    expect(repository).toContain(
      "'create_class_report_cycle'"
    );

    expect(repository).toContain(
      'p_class_id'
    );

    expect(repository).toContain(
      'p_period_start'
    );

    expect(repository).toContain(
      'p_period_end'
    );
  });

  it('derives source eligibility from submitted flexible Teaching Updates', () => {
    const repository = source(repositoryPath);

    expect(repository).toContain(
      "'SUBMITTED'"
    );

    expect(repository).toContain(
      'coverage_kind'
    );

    expect(repository).toContain(
      'period_start'
    );

    expect(repository).toContain(
      'period_end'
    );

    expect(repository).toContain(
      'weekly_submission_dates'
    );
  });

  it('provides a Sources stage with selection and partial-overlap state', () => {
    expect(
      exists(sourcesComponentPath),
      `${sourcesComponentPath} should exist`
    ).toBe(true);

    if (!exists(sourcesComponentPath)) return;

    const component = source(
      sourcesComponentPath
    );

    expect(component).toContain(
      'included'
    );

    expect(component).toContain(
      'partialOverlap'
    );

    expect(component).toContain(
      'setReportCycleSourceIncludedAction'
    );

    expect(component).toContain(
      'requestReportCycleMissingUpdateAction'
    );
    expect(component).toContain('report-source-row');
    expect(component).toContain('formatTeachingUpdateDate');
  });

  it('uses Report Cycles as the primary Admin Reports creation flow', () => {
    const page = source(reportsPagePath);

    expect(page).toContain(
      'createClassReportCycleAction'
    );

    expect(page).toContain(
      'listClassReportCycles'
    );

    expect(page).toContain(
      'classId'
    );

    expect(page).toContain(
      'periodStart'
    );

    expect(page).toContain(
      'periodEnd'
    );
    expect(page).toContain('report-cycle-create');
    expect(page).toContain('report-cycle-active');
    expect(page).toContain('report-cycle-history');
    expect(page.indexOf('report-cycle-active')).toBeLessThan(page.indexOf('report-cycle-create'));
  });

  it('places Sources before the existing student review and delivery workflow', () => {
    const workspace = source(
      workspacePagePath
    );

    expect(workspace).toContain(
      'ReportCycleSources'
    );

    expect(workspace).toContain(
      'finalizeAdminReportWorkspaceAction'
    );

    expect(workspace).toContain(
      'sendAdminReportBatchAction'
    );
  });

  it('exposes source-selection and missing-update actions', () => {
    const actions = source(actionsPath);

    expect(actions).toContain(
      'setReportCycleSourceIncludedAction'
    );

    expect(actions).toContain(
      'requestReportCycleMissingUpdateAction'
    );

    expect(actions).toContain(
      'createClassReportCycleAction'
    );
  });

  it('keeps historical Subject and Group report support in the reporting engine', () => {
    const repository = source(repositoryPath);

    expect(repository).toContain(
      "'SUBJECT'"
    );

    expect(repository).toContain(
      "'GROUP'"
    );

    expect(repository).toContain(
      'finalizeReportBatch'
    );
  });
});
