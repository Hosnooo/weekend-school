import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

import {createStudentEnrollmentSchema} from '@/features/enrollment/enrollment.schemas';
import {guardianSchema} from '@/features/guardians/guardian.schemas';
import {getNavigationSections} from '@/lib/auth/navigation';

const uuid = '11111111-1111-4111-8111-111111111111';

const baseStudent = {
  firstNameEn: 'Adam',
  lastNameEn: 'Ali',
  firstNameAr: '',
  lastNameAr: '',
  classId: uuid,
  startsOn: '2026-09-26',
  subjects: []
};

describe('student-centered Guardian workflow', () => {
  it('allows creating a Student without a Guardian', () => {
    const result = createStudentEnrollmentSchema.safeParse({
      ...baseStudent,
      guardianName: '',
      guardianEmail: '',
      guardianPhone: '',
      reportLanguage: 'en'
    });

    expect(result.success).toBe(true);
  });

  it('rejects partial Guardian details during Student creation', () => {
    const result = createStudentEnrollmentSchema.safeParse({
      ...baseStudent,
      guardianName: 'Fatima Ahmed',
      guardianEmail: 'fatima@example.test',
      guardianPhone: '',
      reportLanguage: 'en'
    });

    expect(result.success).toBe(false);
  });

  it('accepts a complete Guardian including phone during Student creation', () => {
    const result = createStudentEnrollmentSchema.safeParse({
      ...baseStudent,
      guardianName: 'Fatima Ahmed',
      guardianEmail: 'fatima@example.test',
      guardianPhone: '+1 780 555 0100',
      reportLanguage: 'en'
    });

    expect(result.success).toBe(true);
  });

  it('requires phone on a Guardian record', () => {
    expect(guardianSchema.safeParse({
      name: 'Fatima Ahmed',
      email: 'fatima@example.test',
      reportLanguage: 'en'
    }).success).toBe(false);

    expect(guardianSchema.safeParse({
      name: 'Fatima Ahmed',
      email: 'fatima@example.test',
      phone: '+1 780 555 0100',
      reportLanguage: 'en'
    }).success).toBe(true);
  });

  it('removes Guardians from normal Administrator navigation', () => {
    const sections = getNavigationSections({
      isAdmin: true,
      teacherIds: []
    });

    expect(
      sections.flatMap((section) => section.items).some(({href}) => href === '/guardians')
    ).toBe(false);
  });

  it('centers routine Guardian management on Student detail', () => {
    const detail = readFileSync(
      resolve(
        process.cwd(),
        'src/app/[locale]/(protected)/(admin)/students/[id]/page.tsx'
      ),
      'utf8'
    );
    const manager = readFileSync(
      resolve(
        process.cwd(),
        'src/features/guardians/student-guardian-manager.tsx'
      ),
      'utf8'
    );

    expect(detail).toContain('StudentGuardianManager');
    expect(detail).not.toContain('href={`/guardians/${guardian.id}`}');
    expect(manager).toContain("t('phone')");
    expect(manager).toContain('addStudentGuardianAction');
    expect(manager).toContain('updateStudentGuardianAction');
    expect(manager).toContain('unlinkStudentGuardianAction');
  });

  it('makes the standalone Guardians page informational', () => {
    const page = readFileSync(
      resolve(
        process.cwd(),
        'src/app/[locale]/(protected)/(admin)/guardians/page.tsx'
      ),
      'utf8'
    );

    expect(page).not.toContain('GuardianManagementList');
  });
});
