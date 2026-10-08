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
    'src/features/reports/report-cycle-source-review.tsx';

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

    expect(repository).toContain(
      'deleteClassReportCycle'
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

  it('keeps Sources and report editing in one Class Report Cycle workspace', () => {
    const workspace = source(workspacePagePath);
    const sourceReview = source(sourcesComponentPath);

    expect(workspace).toContain('ClassReportCycleReview');
    expect(workspace).not.toContain('ReportCycleSources');
    expect(sourceReview).toContain('ReportEditForm');
    expect(sourceReview).toContain('report-source-editable');
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

    expect(actions).toContain(
      'cancelClassReportCycleAction'
    );

    expect(source(reportsPagePath)).toContain(
      'cancelClassReportCycleAction'
    );

    expect(source(workspacePagePath)).toContain(
      'cancelClassReportCycleAction'
    );
  });

  it('allows administrators to dismiss unsent prepared cycles, but not delivered cycles', () => {
    const repository = source(repositoryPath);
    const listPage = source(reportsPagePath);
    const workspacePage = source(workspacePagePath);
    const migration = source(
      'supabase/migrations/20261008050122_cancel_prepared_unsent_report_cycle.sql'
    );

    expect(repository).toContain("'cancel_class_report_cycle'");
    expect(repository).toContain('getDismissibleClassReportBatchIds');
    expect(repository).toContain("!['DRAFT', 'READY'].includes");
    expect(repository).toContain('email_deliveries(id)');
    expect(listPage).toContain('cycle.canDismiss');
    expect(workspacePage).toContain('classCycle.canDismiss');
    expect(listPage).toContain("t('dismissCycleConfirm')");
    expect(workspacePage).toContain("t('dismissCycleConfirm')");
    expect(migration).toContain("'DRAFT', 'REVIEW', 'FINALIZED'");
    expect(migration).toContain("report.status not in ('DRAFT', 'READY')");
    expect(migration).toContain('public.email_deliveries');
    expect(migration).toContain('newer_report.batch_id is distinct from p_batch_id');
    expect(migration).toContain('public.is_admin()');
    expect(migration).toContain('for update');
    expect(migration).toContain('delete from public.reports');
    expect(migration).not.toContain('delete from public.weekly_submissions');
  });

  it('places report cycle feedback next to the cycle list', () => {
    const page = source(reportsPagePath);

    expect(page.indexOf("query.error")).toBeLessThan(
      page.indexOf('report-cycle-create')
    );
    expect(page.indexOf("query.cancelled")).toBeLessThan(
      page.indexOf('report-cycle-create')
    );
  });

  it('shows only actual historical report batches in the historical section', () => {
    const page = source(reportsPagePath);

    expect(page).toContain('historicalContexts');
    expect(page).toContain('Boolean(batchId)');
    expect(page).toContain('historicalContexts.map');
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
