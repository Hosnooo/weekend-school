import {createHash} from 'node:crypto';
import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

const migrationDirectory = join(process.cwd(), 'supabase', 'migrations');
const seedPath = join(process.cwd(), 'supabase', 'seed.sql');

const appliedMigrationBlobs: Record<string, string> = {
  '202609200001_extensions_and_enums.sql': '5291e951b91b84727a121e5c11f69a958c2c30d3',
  '202609200002_identity_and_school.sql': 'e61167f57bfa29dda754b9d79018d7309f6a21c3',
  '202609200003_administration.sql': 'd5223b5131e6f8248d5e77bdc27f715d7ab6bcf1',
  '202609200004_weekly_updates.sql': '5ac5b0696a3f2273fd299970ccb5afaa99939700',
  '202609200005_reports_and_delivery.sql': 'f393b258f7258c6f19a783e873ddad972fa44187',
  '202609200006_integrity_functions_and_indexes.sql': 'fe2034206157819968c7e4b33e07f8644c9a65a3',
  '202609200007_row_level_security.sql': '1b3e1da5b82f0ee2031ff44181021710f272e412',
  '202609200008_administration_functions.sql': '532e7cf948b1976aa685362c4cc816d024d2c6be',
  '202609200009_teacher_workflow.sql': 'acc251e7be2976cf5f95f0c293bd45123bc770e3',
  '202609200010_report_generation.sql': 'bea6ed0900b1252406c465127611163f190173a8',
  '202609200011_email_delivery.sql': '26d43784dadb196b5f973130e68e5a6be959198c',
  '202609200012_delivery_identity_and_recovery.sql': 'ae75c7e26102d248a242b8ce52a2b42ec6eee775',
  '202609220013_teacher_assignment.sql': '4088410f5d1dab66f8580fbefb02db142d5c0d48',
  '202609220014_student_transfer.sql': 'd976e88edc210bcb5b9c5b7a1b89ac52f6e11b9e',
  '202609220015_protect_submitted_rosters.sql': '27d5d8df9e43f680a634149a6089d3cbed930eb1',
  '202609220016_protect_membership_history.sql': 'a4d1425a03b793fa273c3eac7147f5f3debed88c',
  '202609220017_confirm_group_reassignment.sql': '0084ce5144bc0fb0023f476cfe0e478d9f596a8b',
  '202609220018_revoke_anon_security_definer_execution.sql': '89fb2928399b1a89261c5edfcfa856066c856da4'
};

async function readMigrations() {
  const filenames = (await readdir(migrationDirectory))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  const contents = await Promise.all(
    filenames.map((filename) => readFile(join(migrationDirectory, filename), 'utf8'))
  );

  return {filenames, sql: contents.join('\n')};
}

function gitBlobSha(content: Buffer) {
  const header = Buffer.from(`blob ${content.byteLength}\0`, 'utf8');
  return createHash('sha1').update(header).update(content).digest('hex');
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
    // A local CLI-generated guard migration is staged only after the
    // standalone concurrency verification. Permit exactly one such
    // forward migration without weakening the historical migration order.
    const guardFiles = filenames.filter((name) =>
      /^\d{14}_prevent_last_active_administrator_race\.sql$/.test(name)
    );
    expect(guardFiles.length).toBeLessThanOrEqual(1);
    if (guardFiles.length === 1) {
      expect(guardFiles[0]!).toBe(filenames[filenames.length - 1]);
      expect(Number(guardFiles[0]!.slice(0, 14))).toBeGreaterThan(20261008090000);
      const guardSql = await readFile(join(migrationDirectory, guardFiles[0]!), 'utf8');
      expect(guardSql).toContain('administrators_preserve_last_active');
      expect(guardSql).toContain('delete_administrator_with_accounts');
      expect(guardSql).toContain('update of is_active, school_id');
    }

    expect(filenames.filter((name) => !guardFiles.includes(name))).toEqual([
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
      '202609230021_enrollment_atomic_operations.sql',
      '202609230022_weekly_teaching_submissions.sql',
      '202609230023_weekly_submission_history_context.sql',
      '202609230024_attendance_resolution.sql',
      '202609230025_subject_aware_reports.sql',
      '202609230026_archives_and_delete.sql',
      '202609230027_export_requests.sql',
      '20260924222147_independent_role_records.sql',
      '20260925033643_admin_ux_completion.sql',
      '20260925033656_weekly_context_compatibility.sql',
      '20260927050424_student_guardian_centered_workflow.sql',
      '20260927072000_class_operating_dates.sql',
      '20260927080000_guardian_identity_lifecycle.sql',
      '20260927090000_student_guardian_creation_identity.sql',
      '20260927110000_existing_student_enrollment.sql',
      '20260927113000_weekly_roster_teacher_student_rows.sql',
      '20260927114000_reversible_report_workflow.sql',
      '20260927120000_reporting_workflow_finalization.sql',
      '20260927121000_admin_report_workflow.sql',
      '20260927130000_report_delivery_customization.sql',
      '20260927131000_unified_destructive_delete.sql',
      '20260927132000_roster_csv_import.sql',
      '20260927220000_subject_only_teacher_groups.sql',
      '20260927221000_flexible_teaching_updates.sql',
      '20260927222000_teaching_update_mutations.sql',
      '20260927223000_admin_teaching_update_reopen.sql',
      '20260927224000_shared_teaching_update_access.sql',
      '20260927225000_shared_teaching_update_history_access.sql',
      '20260928230000_class_report_cycles.sql',
      '20260930053000_roster_import_create_classes.sql',
      '20260930063417_restrict_internal_trigger_execution.sql',
      '20260930224102_enrollment_start_correction.sql',
      '20260930225139_correct_transfer_boundary.sql',
      '20261001090000_report_template_bilingual_defaults.sql',
      '20261001100000_preserve_report_review_on_source_toggle.sql',
      '20261001110000_report_attendance_overrides.sql',
      '20261006042000_grant_report_batch_delete.sql',
      '20261006043000_cancel_reopened_report_cycle.sql',
      '20261008050122_cancel_prepared_unsent_report_cycle.sql',
      '20261008090000_allow_teachers_read_active_report_template.sql'
    ]);
  });

  it('keeps applied migrations 1-18 byte-for-byte immutable', async () => {
    for (const [filename, expectedSha] of Object.entries(appliedMigrationBlobs)) {
      const content = await readFile(join(migrationDirectory, filename));
      expect(gitBlobSha(content), filename).toBe(expectedSha);
    }
  });

  it('defines the explicit Class Subject Group foundation in migration 19', async () => {
    const {sql} = await readMigrations();
    const tables = [
      'classes',
      'subjects',
      'class_subjects',
      'subject_groups',
      'class_enrollments',
      'subject_exclusions',
      'subject_group_memberships',
      'teaching_assignments'
    ];

    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`create table public\\.${table}\\b`, 'i'));
    }

    expect(sql).toMatch(/create function public\.create_subject_group\b/i);
    expect(sql).toMatch(/create function public\.student_participates_in_class_subject\b/i);
    expect(sql).toMatch(/create function public\.teacher_can_teach_context\b/i);
    expect(sql).toContain('class_enrollments_one_active_class_per_student');
    expect(sql).toContain('subject_group_memberships_one_group_per_class_subject');
    expect(sql).toContain('teaching_assignments_no_duplicate_overlap');
  });

  it('defines independent teacher-authored weekly submissions in migration 22', async () => {
    const {sql} = await readMigrations();
    expect(sql).toMatch(/create table public\.weekly_submissions\b/i);
    expect(sql).toMatch(/create table public\.weekly_submission_students\b/i);
    expect(sql).toContain('weekly_submissions_one_teacher_context_week');
    expect(sql).toContain('weekly_submission_students_attendance_check');
    expect(sql).toMatch(/create function public\.validate_weekly_submission_context\b/i);
  });

  it('defines the flexible Teaching Update contract in forward migrations', async () => {
    const {filenames, sql} = await readMigrations();

    expect(filenames).toContain(
      '20260927220000_subject_only_teacher_groups.sql'
    );
    expect(filenames).toContain(
      '20260927221000_flexible_teaching_updates.sql'
    );

    expect(sql).toMatch(
      /create table public\.teaching_update_request_sets\b/i
    );
    expect(sql).toMatch(
      /create table public\.weekly_submission_dates\b/i
    );
    expect(sql).toMatch(
      /create or replace function public\.request_teaching_update\b/i
    );
    expect(sql).toMatch(
      /create or replace function public\.submit_teaching_update\b/i
    );
    expect(sql).toMatch(
      /create or replace function public\.dismiss_teaching_update\b/i
    );
    expect(sql).toMatch(
      /drop constraint if exists\s+weekly_submissions_one_teacher_context_week/i
    );
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

  it('defines every legacy MVP table and enables row-level security', async () => {
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

  it('pins legacy duplicate sessions, report identity, and logical deliveries', async () => {
    const {sql} = await readMigrations();

    expect(sql).toContain('unique (school_id, group_id, session_date)');
    expect(sql).toContain(
      'unique (school_id, student_id, period_start, period_end, language)'
    );
    expect(sql).toContain('email_deliveries_logical_recipient_key');
  });
});
