import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const sql = read('supabase/migrations/20261011231340_restore_individual_report_requests.sql');
const view = read('src/features/reports/report-cycle-source-review.tsx');
const actions = read('src/features/reports/admin-report-workflow.actions.ts');

describe('individual report update requests', () => {
  it('keeps individual, Class-wide, and all-Class actions', () => {
    expect(view).toContain('requestReportCycleContextUpdateAction');
    expect(view).toContain('requestReportCycleMissingUpdateAction');
    expect(actions).toContain('requestAllReportCycleMissingUpdatesAction');
    expect(view).toContain('name="classSubjectId"');
    expect(view).toContain('name="subjectGroupId"');
  });
  it('offers individual action only for missing or dismissed work', () => {
    expect(view).toContain("context.requestState === 'MISSING' || context.requestState === 'DISMISSED'");
    expect(view).toContain('name="includeDismissed"');
  });
  it('validates administrator, Class, and active Subject Group access', () => {
    expect(sql).toContain('public.is_admin()');
    expect(sql).toContain("rb.scope_type = 'CLASS'");
    expect(sql).toContain('cs.class_id = target_batch.class_id');
    expect(sql).toContain('sg.id = p_subject_group_id');
    expect(sql).toContain("target_batch.status not in ('DRAFT', 'REVIEW')");
    expect(sql).toContain('if p_subject_group_id is null then');
  });
  it('serializes concurrent requests and checks previous statuses', () => {
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('hashtextextended');
    for (const s of ['DRAFT','SUBMITTED','DISMISSED']) {
      expect(sql).toContain("ws.status = '" + s + "'");
    }
    expect(sql).toContain('not p_include_dismissed');
    expect(sql).toContain('return 0;');
  });
  it('denies anonymous execution', () => {
    expect(sql).toContain('from anon;');
    expect(sql).toContain('to authenticated;');
  });
});
