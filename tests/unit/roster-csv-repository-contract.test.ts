import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

const repositoryPath = join(
  process.cwd(),
  'src/features/roster-csv/roster-csv.repository.ts'
);

describe('roster CSV repository contract', () => {
  it('loads every preview lookup from the requested school', () => {
    expect(existsSync(repositoryPath)).toBe(true);

    const source = readFileSync(repositoryPath, 'utf8');

    expect(source).toContain(".from('schools')");
    expect(source).toContain(".from('subjects')");
    expect(source).toContain(".from('classes')");
    expect(source).toContain(".from('guardians')");
    expect(source).toContain(".from('students')");
    expect(source.match(/\.eq\('school_id', schoolId\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('uses the transactional roster RPC for confirmation', () => {
    expect(existsSync(repositoryPath)).toBe(true);

    const source = readFileSync(repositoryPath, 'utf8');

    expect(source).toContain(".rpc('import_student_roster_with_classes'");
    expect(source).toContain('p_import_hash: input.importHash');
    expect(source).toContain('p_rows: input.rows');
  });

  it('creates missing Classes inside the roster import transaction', () => {
    const migrationPath = join(
      process.cwd(),
      'supabase/migrations/20260930053000_roster_import_create_classes.sql'
    );

    expect(existsSync(migrationPath)).toBe(true);

    const source = readFileSync(migrationPath, 'utf8');

    expect(source).toContain('insert into public.classes');
    expect(source).toContain('pg_advisory_xact_lock');
    expect(source).toContain('return public.import_student_roster(');
  });

});
