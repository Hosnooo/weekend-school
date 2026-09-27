import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('existing Student enrollment', () => {
  it('lets an unassigned existing Student enroll in an active Class', () => {
    const editor = read(
      'src/features/students/student-enrollment-editor.tsx'
    );
    const actions = read('src/features/students/student.actions.ts');
    const repository = read(
      'src/features/enrollment/enrollment.repository.ts'
    );

    expect(editor).toContain('enrollStudentInClassAction');
    expect(editor).not.toContain(
      'enrollment.currentClass && targetClasses.length > 0'
    );

    expect(actions).toContain('enrollStudentInClassAction');
    expect(repository).toContain('enrollStudentInClass');
    expect(repository).toContain("rpc('enroll_student_in_class'");
  });
});
