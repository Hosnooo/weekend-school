import {describe, expect, it} from 'vitest';

import {
  AuthorizationError,
  assertActiveProfile,
  assertRole
} from '@/lib/auth/authorization';

const activeTeacher = {
  id: 'profile-1',
  schoolId: 'school-1',
  displayName: 'Fatima',
  role: 'TEACHER' as const,
  preferredLanguage: 'en' as const,
  isActive: true
};

describe('authorization', () => {
  it('denies an authenticated user who has no provisioned profile', () => {
    expect(() => assertActiveProfile(null)).toThrow(AuthorizationError);
  });

  it('denies an inactive profile', () => {
    expect(() => assertActiveProfile({...activeTeacher, isActive: false})).toThrow(
      AuthorizationError
    );
  });

  it('returns an active profile', () => {
    expect(assertActiveProfile(activeTeacher)).toEqual(activeTeacher);
  });

  it('denies a teacher from an admin-only boundary', () => {
    expect(() => assertRole(activeTeacher, 'ADMIN')).toThrow(AuthorizationError);
  });
});
