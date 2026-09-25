import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

const routes = {
  students: 'src/app/[locale]/(protected)/(admin)/students/page.tsx',
  studentDetail: 'src/app/[locale]/(protected)/(admin)/students/[id]/page.tsx',
  studentEdit: 'src/app/[locale]/(protected)/(admin)/students/[id]/edit/page.tsx',
  studentEnrollment: 'src/app/[locale]/(protected)/(admin)/students/[id]/enrollment/page.tsx',
  guardians: 'src/app/[locale]/(protected)/(admin)/guardians/page.tsx',
  guardianNew: 'src/app/[locale]/(protected)/(admin)/guardians/new/page.tsx',
  guardianDetail: 'src/app/[locale]/(protected)/(admin)/guardians/[id]/page.tsx',
  guardianEdit: 'src/app/[locale]/(protected)/(admin)/guardians/[id]/edit/page.tsx'
};

describe('student, enrollment, and guardian UX contract', () => {
  it('separates Student identity editing from effective-dated enrollment management', () => {
    expect(existsSync(resolve(root, routes.studentDetail))).toBe(true);
    expect(existsSync(resolve(root, routes.studentEnrollment))).toBe(true);
    if (!existsSync(resolve(root, routes.studentDetail)) || !existsSync(resolve(root, routes.studentEnrollment))) return;

    const detail = source(routes.studentDetail);
    const edit = source(routes.studentEdit);
    const enrollment = source(routes.studentEnrollment);

    expect(detail).toContain("t('identity')");
    expect(detail).toContain("t('enrollment')");
    expect(detail).toContain("t('guardians')");
    expect(detail).toContain("t('lifecycle')");
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

  it('uses responsive management-list patterns for Students and Guardians', () => {
    const studentListPath = 'src/features/students/student-management-list.tsx';
    const guardianListPath = 'src/features/guardians/guardian-management-list.tsx';
    expect(existsSync(resolve(root, studentListPath))).toBe(true);
    expect(existsSync(resolve(root, guardianListPath))).toBe(true);
    if (!existsSync(resolve(root, studentListPath)) || !existsSync(resolve(root, guardianListPath))) return;

    const studentsPage = source(routes.students);
    const guardiansPage = source(routes.guardians);
    const studentList = source(studentListPath);
    const guardianList = source(guardianListPath);

    expect(studentsPage).toContain('PageHeader');
    expect(studentsPage).toContain('StudentManagementList');
    expect(studentsPage).not.toContain('<table');
    expect(studentsPage).not.toContain("locale==='ar'");
    expect(studentList).toContain('DataTable');
    expect(studentList).toContain('DropdownMenu');
    expect(studentList).toContain('/enrollment');
    expect(studentList).toContain('/edit');
    expect(studentList).not.toContain('row-actions');

    expect(guardiansPage).toContain('PageHeader');
    expect(guardiansPage).toContain('GuardianManagementList');
    expect(guardiansPage).not.toContain('<table');
    expect(guardiansPage).not.toContain("locale === 'ar'");
    expect(guardianList).toContain('DataTable');
    expect(guardianList).toContain('DropdownMenu');
    expect(guardianList).toContain('/guardians/${guardian.id}');
    expect(guardianList).toContain('/edit');
    expect(guardianList).not.toContain('row-actions');
  });

  it('makes Guardians first-class records with linked Students and canonical routes', () => {
    for (const path of [routes.guardianNew, routes.guardianDetail, routes.guardianEdit]) {
      expect(existsSync(resolve(root, path)), `${path} should exist`).toBe(true);
    }
    if (!existsSync(resolve(root, routes.guardianDetail))) return;

    const detail = source(routes.guardianDetail);
    const form = source('src/features/guardians/guardian-form.tsx');
    const repository = source('src/features/guardians/guardian.repository.ts');
    const actions = source('src/features/guardians/guardian.actions.ts');

    expect(detail).toContain("t('contact')");
    expect(detail).toContain("t('linkedStudents')");
    expect(detail).toContain("t('reportLanguage')");
    expect(detail).toContain("t('lifecycle')");
    expect(detail).not.toContain('GuardianForm');
    expect(repository).toContain('student_guardians');
    expect(form).toContain('href="/guardians"');
    expect(actions).toContain('/guardians');
    expect(actions).not.toContain('/students/guardians');
  });
});
