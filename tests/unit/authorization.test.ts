import {describe, expect, it, vi} from 'vitest';

import {
  AuthorizationError,
  assertActiveProfile,
  assertRole,
  assertTeachingProfile,
  requireAdmin,
  requireTeachingContextAccess,
  type AuthorizationDependencies
} from '@/lib/auth/authorization';

const activeTeacher = {
  id: 'profile-1',
  schoolId: 'school-1',
  displayName: 'Fatima',
  role: 'TEACHER' as const,
  preferredLanguage: 'en' as const,
  isActive: true
};

const activeAdmin = {
  ...activeTeacher,
  id: 'admin-1',
  displayName: 'Admin',
  role: 'ADMIN' as const
};

function dependencies(
  profile = activeTeacher,
  canTeach = true
): AuthorizationDependencies {
  return {
    loadProfile: vi.fn().mockResolvedValue(profile),
    canTeachContext: vi.fn().mockResolvedValue(canTeach)
  };
}

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

  it('permits an active administrator to enter assigned teaching routes', () => {
    expect(assertTeachingProfile(activeAdmin).role).toBe('ADMIN');
    expect(() => assertTeachingProfile({...activeAdmin, isActive: false})).toThrow(AuthorizationError);
  });

  it('requires an active ADMIN profile for administrator services', async () => {
    await expect(requireAdmin(dependencies(activeAdmin))).resolves.toEqual(activeAdmin);
    await expect(requireAdmin(dependencies(activeTeacher))).rejects.toThrow(AuthorizationError);
    await expect(
      requireAdmin(dependencies({...activeAdmin, isActive: false}))
    ).rejects.toThrow(AuthorizationError);
  });

  it('requires an effective teaching assignment even when the active profile is ADMIN', async () => {
    const context = {classSubjectId: 'class-subject-1', subjectGroupId: null};
    const denied = dependencies(activeAdmin, false);

    await expect(requireTeachingContextAccess(context, denied)).rejects.toThrow(
      AuthorizationError
    );
    expect(denied.canTeachContext).toHaveBeenCalledWith(activeAdmin, context);
  });

  it('returns the active teacher when the effective teaching context is granted', async () => {
    const context = {classSubjectId: 'class-subject-1', subjectGroupId: 'group-1'};
    const allowed = dependencies(activeTeacher, true);

    await expect(requireTeachingContextAccess(context, allowed)).resolves.toEqual(activeTeacher);
    expect(allowed.canTeachContext).toHaveBeenCalledWith(activeTeacher, context);
  });

  it('rejects an inactive profile before checking the teaching assignment', async () => {
    const denied = dependencies({...activeTeacher, isActive: false}, true);

    await expect(
      requireTeachingContextAccess(
        {classSubjectId: 'class-subject-1', subjectGroupId: null},
        denied
      )
    ).rejects.toThrow(AuthorizationError);
    expect(denied.canTeachContext).not.toHaveBeenCalled();
  });
});
