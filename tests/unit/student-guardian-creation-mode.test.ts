import {describe, expect, it} from 'vitest';

import {
  createStudentEnrollmentSchema
} from '@/features/enrollment/enrollment.schemas';

const classId = '11111111-1111-4111-8111-111111111111';
const guardianId = '22222222-2222-4222-8222-222222222222';

const base = {
  firstNameEn: 'Adam',
  lastNameEn: 'Ali',
  firstNameAr: '',
  lastNameAr: '',
  classId,
  startsOn: '2026-09-27',
  subjects: [],
  reportLanguage: 'en' as const
};

describe('Student creation Guardian identity mode', () => {
  it('accepts explicit no-Guardian mode', () => {
    expect(createStudentEnrollmentSchema.safeParse({
      ...base,
      guardianMode: 'none',
      guardianId: '',
      guardianName: '',
      guardianEmail: '',
      guardianPhone: ''
    }).success).toBe(true);
  });

  it('accepts an existing Guardian only by explicit ID', () => {
    expect(createStudentEnrollmentSchema.safeParse({
      ...base,
      guardianMode: 'existing',
      guardianId,
      guardianName: '',
      guardianEmail: '',
      guardianPhone: ''
    }).success).toBe(true);
  });

  it('rejects existing mode without a Guardian ID', () => {
    expect(createStudentEnrollmentSchema.safeParse({
      ...base,
      guardianMode: 'existing',
      guardianId: '',
      guardianName: '',
      guardianEmail: '',
      guardianPhone: ''
    }).success).toBe(false);
  });

  it('accepts complete new-Guardian identity data', () => {
    expect(createStudentEnrollmentSchema.safeParse({
      ...base,
      guardianMode: 'new',
      guardianId: '',
      guardianName: 'Fatima Ahmed',
      guardianEmail: 'fatima@example.test',
      guardianPhone: '+1 780 555 0100'
    }).success).toBe(true);
  });

  it('rejects new mode when an existing Guardian ID is supplied', () => {
    expect(createStudentEnrollmentSchema.safeParse({
      ...base,
      guardianMode: 'new',
      guardianId,
      guardianName: 'Fatima Ahmed',
      guardianEmail: 'fatima@example.test',
      guardianPhone: '+1 780 555 0100'
    }).success).toBe(false);
  });
});
