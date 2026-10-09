import {describe, expect, it, vi} from 'vitest';

import {
  createAdministratorBusinessRecord,
  deleteAdministratorSafely,
  ensureAdministratorAccess,
  setAdministratorActiveSafely,
  type AdministratorAccessDependencies,
  type AdministratorBusinessRecordDependencies,
  type AdministratorLifecycleDependencies
} from '@/features/administrators/administrator.service';

const schoolId = '10000000-0000-4000-8000-000000000001';
const administratorId = '20000000-0000-4000-8000-000000000001';
const profileId = '30000000-0000-4000-8000-000000000001';

function accessDependencies(
  overrides: Partial<AdministratorAccessDependencies> = {}
): AdministratorAccessDependencies {
  return {
    loadAdministrator: vi.fn().mockResolvedValue({
      id: administratorId,
      schoolId,
      displayName: 'Second Admin'
    }),
    findAuthUserByEmail: vi.fn().mockResolvedValue(null),
    findProfileByAuthUserId: vi.fn().mockResolvedValue(null),
    inviteAuthUser: vi.fn().mockResolvedValue('auth-user-1'),
    createProfile: vi.fn().mockResolvedValue(profileId),
    linkAdministratorAccount: vi.fn().mockResolvedValue(undefined),
    sendAccessLink: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function lifecycleDependencies(
  overrides: Partial<AdministratorLifecycleDependencies> = {}
): AdministratorLifecycleDependencies {
  return {
    loadAdministrator: vi.fn().mockResolvedValue({
      id: administratorId,
      schoolId,
      isActive: true
    }),
    countActiveAdministrators: vi.fn().mockResolvedValue(2),
    setAdministratorActive: vi.fn().mockResolvedValue(undefined),
    deleteAdministratorWithAccountLinks: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('administrator business records', () => {
  it('creates an Administrator record without inferring Teacher access or login identity', async () => {
    const deps: AdministratorBusinessRecordDependencies = {
      createAdministrator: vi.fn().mockResolvedValue(administratorId)
    };

    const id = await createAdministratorBusinessRecord({
      schoolId,
      displayName: ' Second Admin ',
      email: ' ADMIN2@EXAMPLE.COM '
    }, deps);

    expect(id).toBe(administratorId);
    expect(deps.createAdministrator).toHaveBeenCalledWith({
      schoolId,
      displayName: 'Second Admin',
      email: 'admin2@example.com'
    });
  });
});

describe('administrator account access', () => {
  it('reuses an existing same-school Profile without changing Teacher capability or password', async () => {
    const deps = accessDependencies({
      findAuthUserByEmail: vi.fn().mockResolvedValue({id: 'auth-user-existing'}),
      findProfileByAuthUserId: vi.fn().mockResolvedValue({id: profileId, schoolId})
    });

    await ensureAdministratorAccess({
      schoolId,
      administratorId,
      loginEmail: 'existing@example.com',
      redirectTo: 'https://example.test/en/set-password'
    }, deps);

    expect(deps.inviteAuthUser).not.toHaveBeenCalled();
    expect(deps.createProfile).not.toHaveBeenCalled();
    expect(deps.sendAccessLink).not.toHaveBeenCalled();
    expect(deps.linkAdministratorAccount).toHaveBeenCalledWith({
      schoolId,
      administratorId,
      profileId
    });
  });

  it('sends a reset link only when existing Administrator access is explicitly resent', async () => {
    const deps = accessDependencies({
      findAuthUserByEmail: vi.fn().mockResolvedValue({id: 'auth-user-existing'}),
      findProfileByAuthUserId: vi.fn().mockResolvedValue({id: profileId, schoolId})
    });

    await ensureAdministratorAccess({
      schoolId,
      administratorId,
      loginEmail: 'existing@example.com',
      redirectTo: 'https://example.test/en/set-password',
      resendExistingAccess: true
    }, deps);

    expect(deps.sendAccessLink).toHaveBeenCalledWith(
      'existing@example.com',
      'https://example.test/en/set-password'
    );
  });

  it('rejects reuse of a Profile belonging to another school', async () => {
    const deps = accessDependencies({
      findAuthUserByEmail: vi.fn().mockResolvedValue({id: 'auth-user-existing'}),
      findProfileByAuthUserId: vi.fn().mockResolvedValue({
        id: profileId,
        schoolId: '10000000-0000-4000-8000-000000000099'
      })
    });

    await expect(ensureAdministratorAccess({
      schoolId,
      administratorId,
      loginEmail: 'existing@example.com',
      redirectTo: 'https://example.test/en/set-password'
    }, deps)).rejects.toThrow('another school');

    expect(deps.linkAdministratorAccount).not.toHaveBeenCalled();
  });
});

describe('administrator lifecycle safeguards', () => {
  it('refuses to deactivate the last active Administrator', async () => {
    const deps = lifecycleDependencies({countActiveAdministrators: vi.fn().mockResolvedValue(1)});

    await expect(setAdministratorActiveSafely({
      schoolId,
      administratorId,
      isActive: false
    }, deps)).rejects.toThrow('last active Administrator');

    expect(deps.setAdministratorActive).not.toHaveBeenCalled();
  });

  it('allows reactivation without the last-Administrator check', async () => {
    const deps = lifecycleDependencies({
      loadAdministrator: vi.fn().mockResolvedValue({id: administratorId, schoolId, isActive: false}),
      countActiveAdministrators: vi.fn().mockResolvedValue(1)
    });

    await setAdministratorActiveSafely({
      schoolId,
      administratorId,
      isActive: true
    }, deps);

    expect(deps.setAdministratorActive).toHaveBeenCalledWith(schoolId, administratorId, true);
  });

  it('refuses to delete the last active Administrator', async () => {
    const deps = lifecycleDependencies({countActiveAdministrators: vi.fn().mockResolvedValue(1)});

    await expect(deleteAdministratorSafely({schoolId, administratorId}, deps))
      .rejects.toThrow('last active Administrator');

    expect(deps.deleteAdministratorWithAccountLinks).not.toHaveBeenCalled();
  });

  it('deletes only Administrator links and the Administrator record when another active Admin remains', async () => {
    const deps = lifecycleDependencies();

    await deleteAdministratorSafely({schoolId, administratorId}, deps);

    expect(deps.deleteAdministratorWithAccountLinks).toHaveBeenCalledWith(schoolId, administratorId);
  });
});
