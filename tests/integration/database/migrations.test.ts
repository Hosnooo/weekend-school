import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

const migrationDirectory = join(process.cwd(), 'supabase', 'migrations');
const seedPath = join(process.cwd(), 'supabase', 'seed.sql');

async function readMigrations() {
  const filenames = (await readdir(migrationDirectory))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  const contents = await Promise.all(
    filenames.map((filename) => readFile(join(migrationDirectory, filename), 'utf8'))
  );

  return {filenames, sql: contents.join('\n')};
}

describe('migration contract', () => {
  it('seeds session children before submitting their immutable parent sessions', async () => {
    const seed = await readFile(seedPath, 'utf8');
    const sessionInsert = seed.indexOf('insert into public.sessions');
    const progressInsert = seed.indexOf('insert into public.group_progress');
    const submissionUpdate = seed.indexOf("update public.sessions set status = 'SUBMITTED'");

    expect(sessionInsert).toBeGreaterThanOrEqual(0);
    expect(progressInsert).toBeGreaterThan(sessionInsert);
    expect(submissionUpdate).toBeGreaterThan(progressInsert);
    expect(seed).toMatch(/join public\.sessions[\s\S]*sessions\.status = 'DRAFT'/);
    expect(seed).toMatch(/where[\s\S]*status = 'DRAFT'[\s\S]*update public\.sessions set status = 'SUBMITTED'/);
    expect(seed).toMatch(/update public\.sessions set status = 'SUBMITTED'[\s\S]*and status = 'DRAFT'/);
  });

  it('keeps migrations in dependency order', async () => {
    const {filenames} = await readMigrations();

    expect(filenames).toEqual([
      '202609200001_extensions_and_enums.sql',
      '202609200002_identity_and_school.sql',
      '202609200003_administration.sql',
      '202609200004_weekly_updates.sql',
      '202609200005_reports_and_delivery.sql',
      '202609200006_integrity_functions_and_indexes.sql',
      '202609200007_row_level_security.sql',
      '202609200008_administration_functions.sql',
      '202609200009_teacher_workflow.sql',
      '202609200010_report_generation.sql',
      '202609200011_email_delivery.sql',
      '202609200012_delivery_identity_and_recovery.sql',
      '202609220013_teacher_assignment.sql',
      '202609220014_student_transfer.sql',
      '202609220015_protect_submitted_rosters.sql',
      '202609220016_protect_membership_history.sql',
      '202609220017_confirm_group_reassignment.sql',
      '202609220018_revoke_anon_security_definer_execution.sql',
      '202609220019_class_subject_group_foundation.sql',
      '202609220020_class_subject_group_rls.sql',
      '202609220021_weekly_teaching_submissions.sql',
      '202609220022_attendance_resolution.sql',
      '202609220023_subject_aware_reports.sql',
      '202609220024_archives_and_delete.sql',
      '202609230025_redesign_workflow_hardening.sql'
    ]);
  });

  it('revokes anonymous execution from security definer functions and future defaults', async () => {
    const {sql} = await readMigrations();

    expect(sql).toContain("where n.nspname = 'public'");
    expect(sql).toContain('and p.prosecdef');
    expect(sql).toContain("revoke execute on function %s from anon");
    expect(sql).toMatch(
      /alter default privileges for role postgres in schema public\s+revoke execute on functions from anon/i
    );
  });

  it('saves and submits weekly updates atomically', async () => {
    const {sql}=await readMigrations();
    expect(sql).toMatch(/create function public\.save_weekly_update\b/i);
    expect(sql).toContain("raise exception 'submitted sessions are immutable'");
  });

  it('inserts immutable report snapshots atomically',async()=>{const{sql}=await readMigrations();expect(sql).toMatch(/create function public\.generate_report_snapshots\b/i);expect(sql).toContain('on conflict (school_id, student_id, period_start, period_end, language) do nothing');});
  it('reserves logical deliveries across report-language changes and safely recovers recent pending attempts',async()=>{const{sql}=await readMigrations();expect(sql).toMatch(/create (or replace )?function public\.reserve_report_delivery\b/i);expect(sql).toMatch(/create function public\.complete_report_delivery\b/i);expect(sql).toContain('email_deliveries_logical_recipient_key');expect(sql).toContain("existing_delivery.status = 'PENDING'");expect(sql).toContain("interval '23 hours'");expect(sql).toMatch(/'requires_reconciliation',\s*true/);});

  it('provides an atomic student and guardian creation function', async () => {
    const {sql} = await readMigrations();

    expect(sql).toMatch(/create function public\.create_student_with_guardian\b/i);
    expect(sql).toContain('grant execute on function public.create_student_with_guardian');
    expect(sql).toContain('create unique index group_teachers_one_primary_idx');
    expect(sql).toMatch(/create function public\.update_teacher_administration\b/i);
  });

  it('defines every MVP table and enables row-level security', async () => {
    const {sql} = await readMigrations();
    const tables = [
      'schools',
      'profiles',
      'students',
      'guardians',
      'student_guardians',
      'groups',
      'group_teachers',
      'group_memberships',
      'sessions',
      'group_progress',
      'attendance',
      'student_progress',
      'reports',
      'email_deliveries'
    ];

    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`create table public\\.${table}\\b`, 'i'));
      expect(sql).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`, 'i')
      );
    }
  });

  it('pins duplicate sessions, report identity, and logical deliveries', async () => {
    const {sql} = await readMigrations();

    expect(sql).toContain('unique (school_id, group_id, session_date)');
    expect(sql).toContain(
      'unique (school_id, student_id, period_start, period_end, language)'
    );
    expect(sql).toContain('email_deliveries_logical_recipient_key');
  });
});
