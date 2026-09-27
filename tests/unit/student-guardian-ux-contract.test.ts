import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();
const source = (path: string) =>
  readFileSync(resolve(root, path), 'utf8');

const routes = {
  students: 'src/app/[locale]/(protected)/(admin)/students/page.tsx',
  studentDetail: 'src/app/[locale]/(protected)/(admin)/students/[id]/page.tsx',
  studentEdit:
    'src/app/[locale]/(protected)/(admin)/students/[id]/edit/page.tsx',
  studentEnrollment:
    'src/app/[locale]/(protected)/(admin)/students/[id]/enrollment/page.tsx',
  guardians:
    'src/app/[locale]/(protected)/(admin)/guardians/page.tsx'
};

describe('student, enrollment, and Guardian UX contract', () => {
  it('separates Student identity editing from effective-dated enrollment management', () => {
    expect(existsSync(resolve(root, routes.studentDetail))).toBe(true);
    expect(existsSync(resolve(root, routes.studentEnrollment))).toBe(true);

    const detail = source(routes.studentDetail);
    const edit = source(routes.studentEdit);
    const enrollment = source(routes.studentEnrollment);

    expect(detail).toContain("teachersT('identityContact')");
    expect(detail).toContain("t('enrollment')");
    expect(detail).toContain('StudentGuardianManager');
    expect(detail).toContain("teachersT('lifecycle')");
    expect(detail).toContain('/edit');
    expect(detail).toContain('/enrollment');
    expect(detail).not.toContain('StudentForm');
    expect(detail).not.toContain('StudentEnrollmentEditor');

    expect(edit).toContain('StudentForm');
    expect(edit).not.toContain('StudentEnrollmentEditor');
    expect(edit).not.toContain('getStudentEnrollmentState');
    expect(edit).not.toContain('listEnrollmentClasses');

    expect(enrollment).toContain('StudentEnrollmentEditor');
    expect(enrollment).toContain('getStudentEnrollmentState');
    expect(enrollment).toContain('listEnrollmentClasses');
    expect(enrollment).not.toContain('StudentForm');
    expect(enrollment).not.toContain('updateStudentAction');
  });

  it('keeps Students on the responsive management-list pattern', () => {
    const studentListPath =
      'src/features/students/student-management-list.tsx';

    const studentsPage = source(routes.students);
    const studentList = source(studentListPath);

    expect(studentsPage).toContain('PageHeader');
    expect(studentsPage).toContain('StudentManagementList');
    expect(studentsPage).not.toContain('<table');
    expect(studentList).toContain('DataTable');
    expect(studentList).toContain('DropdownMenu');
    expect(studentList).toContain('/enrollment');
    expect(studentList).toContain('/edit');
  });

  it('centers Guardian management on the Student record', () => {
    const detail = source(routes.studentDetail);
    const manager = source(
      'src/features/guardians/student-guardian-manager.tsx'
    );
    const repository = source(
      'src/features/guardians/guardian.repository.ts'
    );

    expect(detail).toContain('StudentGuardianManager');
    expect(manager).toContain('addStudentGuardianAction');
    expect(manager).toContain('updateStudentGuardianAction');
    expect(manager).toContain('unlinkStudentGuardianAction');
    expect(manager).toContain("t('phone')");
    expect(repository).toContain('student_guardians');
    expect(repository).toContain('phone');
  });

  it('keeps the standalone Guardians route informational', () => {
    const guardiansPage = source(routes.guardians);

    expect(guardiansPage).toContain('PageHeader');
    expect(guardiansPage).toContain("t('standaloneNoticeTitle')");
    expect(guardiansPage).not.toContain('GuardianManagementList');
    expect(guardiansPage).not.toContain('/guardians/new');
  });
});
