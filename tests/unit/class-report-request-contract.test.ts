import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const migration = read('supabase/migrations/20261011220100_class_report_request_idempotency.sql');
const repository = read('src/features/reports/report-batch.repository.ts');
const actions = read('src/features/reports/admin-report-workflow.actions.ts');
const review = read('src/features/reports/report-cycle-source-review.tsx');
const reports = read('src/app/[locale]/(protected)/(admin)/reports/page.tsx');

describe('Idempotent Class Report Cycle request coordination', () => {
  it('validates Class Report Cycle ownership and status inside the database', () => {
    expect(migration).toContain("scope_type = 'CLASS'");
    expect(migration).toContain("target_batch.status not in ('DRAFT', 'REVIEW')");
    expect(migration).toContain('public.is_admin()');
  });
  it('serializes simultaneous requests and skips existing work', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain("ws.status = 'DRAFT'");
    expect(migration).toContain("ws.status = 'SUBMITTED'");
    expect(migration).toContain("ws.status = 'DISMISSED'");
    expect(migration).toContain('not p_include_dismissed');
    expect(migration).toContain('request_set_id');
    expect(migration).toContain('target_group_id');
  });
  it('only bulk-requests work in matching unfinished Report Cycles', () => {
    expect(migration).toContain("rb.scope_type = 'CLASS'");
    expect(migration).toContain("rb.status in ('DRAFT', 'REVIEW')");
    expect(migration).toContain('rb.period_start = p_period_start');
    expect(migration).toContain('rb.period_end = p_period_end');
    expect(migration).toContain('request_missing_class_report_updates(target_batch_id, false)');
  });
  it('shows missing, pending, submitted, and dismissed states', () => {
    for (const state of ['RECEIVED', 'PENDING', 'DISMISSED', 'MISSING']) {
      expect(repository).toContain(state);
      expect(review).toContain(state);
    }
    expect(review).toContain('dismissalReason');
    expect(review).not.toContain('name="classSubjectId"\n                      type="hidden"\n                      value={context.classSubjectId}\n                    />');
  });
  it('keeps class and bulk requests separate and bilingual', () => {
    expect(actions).toContain("'request_missing_class_report_updates'");
    expect(actions).toContain("'request_all_missing_report_cycle_updates'");
    expect(reports).toContain('requestAllReportCycleMissingUpdatesAction');
    for (const path of ['messages/en.json', 'messages/ar.json']) {
      const translations = JSON.parse(read(path));
      expect(translations.reports.requestAllMissing).toBeTruthy();
      expect(translations.reports.bulkRequestResult).toBeTruthy();
    }
  });
});
