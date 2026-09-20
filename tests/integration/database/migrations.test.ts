import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

const migrationDirectory = join(process.cwd(), 'supabase', 'migrations');

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
  it('keeps the seven foundation migrations in dependency order', async () => {
    const {filenames} = await readMigrations();

    expect(filenames).toEqual([
      '202609200001_extensions_and_enums.sql',
      '202609200002_identity_and_school.sql',
      '202609200003_administration.sql',
      '202609200004_weekly_updates.sql',
      '202609200005_reports_and_delivery.sql',
      '202609200006_integrity_functions_and_indexes.sql',
      '202609200007_row_level_security.sql'
    ]);
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
    expect(sql).toContain('unique (report_id, guardian_id)');
  });
});
