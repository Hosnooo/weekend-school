import {describe, expect, it, vi} from 'vitest';

import type {Profile} from '@/features/profiles/profile.types';
import {
  AuthorizationError,
  assertActiveProfile,
  requireAdmin,
  requireTeachingCapability,
  requireTeachingContextAccess,
  type AccountCapabilities,
  type AuthorizationDependencies
} from '@/lib/auth/authorization';

const activeProfile: Profile = {
  id: 'profile-1',
  schoolId: 'school-1',
  displayName: 'Fatima',
  preferredLanguage: 'en',
  isActive: true
};

const adminOnly: AccountCapabilities = {isAdmin: true, teacherIds: []};
const teacherOnly: AccountCapabilities = {isAdmin: false, teacherIds: ['teacher-1']};
const dualRole: AccountCapabilities = {isAdmin: true, teacherIds: ['teacher-1']};

function dependencies(
  profile: Profile = activeProfile,
  capabilities: AccountCapabilities = teacherOnly,
  canTeachContext = true
): AuthorizationDependencies {
  return {
    loadProfile: vi.fn().mockResolvedValue(profile),
    loadCapabilities: vi.fn().mockResolvedValue(capabilities),
    canTeachContext: vi.fn().mockResolvedValue(canTeachContext)
  };
}

describe('authorization', () => {
  it('denies an authenticated user who has no provisioned profile', () => {
    expect(() => assertActiveProfile(null)).toThrow(AuthorizationError);
  });

  it('denies an inactive profile', () => {
    expect(() => assertActiveProfile({...activeProfile, isActive: false})).toThrow(
      AuthorizationError
    );
  });

  it('returns an active profile', () => {
    expect(assertActiveProfile(activeProfile)).toEqual(activeProfile);
  });

  it('requires an explicit Administrator capability for administrator services', async () => {
    await expect(requireAdmin(dependencies(activeProfile, adminOnly))).resolves.toEqual(activeProfile);
    await expect(requireAdmin(dependencies(activeProfile, teacherOnly))).rejects.toThrow(
      AuthorizationError
    );
  });

  it('requires an explicit Teacher capability for teaching routes', async () => {
    await expect(requireTeachingCapability(dependencies(activeProfile, adminOnly))).rejects.toThrow(
      AuthorizationError
    );
    await expect(requireTeachingCapability(dependencies(activeProfile, teacherOnly))).resolves.toEqual({
      profile: activeProfile,
      teacherIds: ['teacher-1']
    });
    await expect(requireTeachingCapability(dependencies(activeProfile, dualRole))).resolves.toEqual({
      profile: activeProfile,
      teacherIds: ['teacher-1']
    });
  });

  it('requires an effective teaching assignment after Teacher capability is established', async () => {
    const context = {classSubjectId: 'class-subject-1', subjectGroupId: null};
    const denied = dependencies(activeProfile, teacherOnly, false);

    await expect(requireTeachingContextAccess(context, denied)).rejects.toThrow(AuthorizationError);
    expect(denied.canTeachContext).toHaveBeenCalledWith(activeProfile, context);
  });

  it('returns the active teaching profile when capability and context are granted', async () => {
    const context = {classSubjectId: 'class-subject-1', subjectGroupId: 'group-1'};
    const allowed = dependencies(activeProfile, teacherOnly, true);

    await expect(requireTeachingContextAccess(context, allowed)).resolves.toEqual(activeProfile);
    expect(allowed.canTeachContext).toHaveBeenCalledWith(activeProfile, context);
  });

  it('rejects an inactive profile before loading capabilities or checking assignments', async () => {
    const denied = dependencies({...activeProfile, isActive: false}, teacherOnly, true);

    await expect(
      requireTeachingContextAccess(
        {classSubjectId: 'class-subject-1', subjectGroupId: null},
        denied
      )
    ).rejects.toThrow(AuthorizationError);
    expect(denied.loadCapabilities).not.toHaveBeenCalled();
    expect(denied.canTeachContext).not.toHaveBeenCalled();
  });
});
