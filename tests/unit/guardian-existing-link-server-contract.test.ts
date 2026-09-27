import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();
const source = (path: string) =>
  readFileSync(resolve(root, path), 'utf8');

describe('existing Guardian server linking', () => {
  it('uses an explicit Guardian-ID server path with duplicate-link feedback', () => {
    const schemas = source(
      'src/features/guardians/guardian.schemas.ts'
    );
    const repository = source(
      'src/features/guardians/guardian.repository.ts'
    );
    const actions = source(
      'src/features/guardians/guardian.actions.ts'
    );

    expect(schemas).toContain(
      'studentGuardianExistingLinkSchema'
    );
    expect(schemas).toContain('guardianId: databaseUuid');

    expect(repository).toContain(
      'linkExistingGuardianToStudent'
    );
    expect(repository).toContain(
      "supabase.rpc('link_existing_student_guardian'"
    );
    expect(repository).toContain(
      'p_guardian_id: input.guardianId'
    );

    expect(actions).toContain(
      'linkExistingStudentGuardianAction'
    );
    expect(actions).toContain(
      'studentGuardianExistingLinkSchema.safeParse'
    );
    expect(actions).toContain(
      'linkExistingGuardianToStudent(parsed.data)'
    );

    expect(actions).toContain(
      "String(error.code) === '23505'"
    );
    expect(actions).toContain(
      "saveFailure('guardianAlreadyLinked')"
    );
  });
});
