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

    expect(source).toContain(".rpc('import_student_roster'");
    expect(source).toContain('p_import_hash: input.importHash');
    expect(source).toContain('p_rows: input.rows');
  });
});
