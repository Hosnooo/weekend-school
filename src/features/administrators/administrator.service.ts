export type AdministratorBusinessInput = {
  schoolId: string;
  displayName: string;
  email: string;
};

export type AdministratorAccountLink = {
  schoolId: string;
  administratorId: string;
  profileId: string;
};

export type AdministratorBusinessRecordDependencies = {
  createAdministrator(input: AdministratorBusinessInput): Promise<string>;
};

export type AdministratorAccessDependencies = {
  loadAdministrator(
    administratorId: string,
    schoolId: string
  ): Promise<{
    id: string;
    schoolId: string;
    displayName: string;
  } | null>;
  findAuthUserByEmail(email: string): Promise<{id: string} | null>;
  findProfileByAuthUserId(
    authUserId: string
  ): Promise<{id: string; schoolId: string; isActive?: boolean} | null>;
  inviteAuthUser(input: {
    email: string;
    displayName: string;
    preferredLanguage: 'en' | 'ar';
    redirectTo: string;
  }): Promise<string>;
  createProfile(input: {
    schoolId: string;
    authUserId: string;
    displayName: string;
    preferredLanguage: 'en' | 'ar';
  }): Promise<string>;
  linkAdministratorAccount(input: AdministratorAccountLink): Promise<void>;
  sendAccessLink(email: string, redirectTo: string): Promise<void>;
  deleteProfile?: (profileId: string) => Promise<void>;
  deleteAuthUser?: (authUserId: string) => Promise<void>;
};

export type AdministratorLifecycleDependencies = {
  loadAdministrator(
    administratorId: string,
    schoolId: string
  ): Promise<{
    id: string;
    schoolId: string;
    isActive: boolean;
  } | null>;
  countActiveAdministrators(schoolId: string): Promise<number>;
  setAdministratorActive(schoolId: string, administratorId: string, isActive: boolean): Promise<void>;
  deleteAdministratorWithAccountLinks(schoolId: string, administratorId: string): Promise<void>;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeName(displayName: string) {
  const value = displayName.trim();
  if (!value) throw new Error('Administrator display name is required');
  return value;
}

function assertLoginEmail(email: string) {
  if (!email || !email.includes('@')) throw new Error('A valid login email is required');
}

function lastAdministratorError() {
  return new Error('Cannot remove the last active Administrator');
}

export async function createAdministratorBusinessRecord(
  input: AdministratorBusinessInput,
  dependencies: AdministratorBusinessRecordDependencies
) {
  const email = normalizeEmail(input.email);
  assertLoginEmail(email);
  return dependencies.createAdministrator({
    ...input,
    displayName: normalizeName(input.displayName),
    email
  });
}

export async function ensureAdministratorAccess(
  input: {
    schoolId: string;
    administratorId: string;
    loginEmail: string;
    redirectTo: string;
    preferredLanguage?: 'en' | 'ar';
    resendExistingAccess?: boolean;
  },
  dependencies: AdministratorAccessDependencies
) {
  const loginEmail = normalizeEmail(input.loginEmail);
  assertLoginEmail(loginEmail);

  const administrator = await dependencies.loadAdministrator(input.administratorId, input.schoolId);
  if (!administrator || administrator.schoolId !== input.schoolId) {
    throw new Error('Administrator is not available in this school');
  }

  const preferredLanguage = input.preferredLanguage ?? 'en';
  const existingAuth = await dependencies.findAuthUserByEmail(loginEmail);
  let authUserId: string;
  let profileId: string;
  let createdAuth = false;
  let createdProfile = false;

  if (existingAuth) {
    authUserId = existingAuth.id;
    const profile = await dependencies.findProfileByAuthUserId(authUserId);
    if (profile && profile.schoolId !== input.schoolId) {
      throw new Error('This login belongs to another school');
    }
    if (profile?.isActive === false) {
      throw new Error('This login profile is inactive');
    }
    if (profile) {
      profileId = profile.id;
    } else {
      profileId = await dependencies.createProfile({
        schoolId: input.schoolId,
        authUserId,
        displayName: administrator.displayName,
        preferredLanguage
      });
      createdProfile = true;
    }
  } else {
    authUserId = await dependencies.inviteAuthUser({
      email: loginEmail,
      displayName: administrator.displayName,
      preferredLanguage,
      redirectTo: input.redirectTo
    });
    createdAuth = true;
    try {
      profileId = await dependencies.createProfile({
        schoolId: input.schoolId,
        authUserId,
        displayName: administrator.displayName,
        preferredLanguage
      });
      createdProfile = true;
    } catch (error) {
      if (dependencies.deleteAuthUser) {
        try { await dependencies.deleteAuthUser(authUserId); } catch {}
      }
      throw error;
    }
  }

  try {
    await dependencies.linkAdministratorAccount({
      schoolId: input.schoolId,
      administratorId: input.administratorId,
      profileId
    });
  } catch (error) {
    if (createdProfile && dependencies.deleteProfile) {
      try { await dependencies.deleteProfile(profileId); } catch {}
    }
    if (createdAuth && dependencies.deleteAuthUser) {
      try { await dependencies.deleteAuthUser(authUserId); } catch {}
    }
    throw error;
  }

  if (existingAuth && input.resendExistingAccess) {
    await dependencies.sendAccessLink(loginEmail, input.redirectTo);
  }

  return profileId;
}

export async function setAdministratorActiveSafely(
  input: {schoolId: string; administratorId: string; isActive: boolean},
  dependencies: AdministratorLifecycleDependencies
) {
  const administrator = await dependencies.loadAdministrator(input.administratorId, input.schoolId);
  if (!administrator || administrator.schoolId !== input.schoolId) {
    throw new Error('Administrator is not available in this school');
  }

  if (administrator.isActive === input.isActive) return;

  if (administrator.isActive && !input.isActive) {
    const activeCount = await dependencies.countActiveAdministrators(input.schoolId);
    if (activeCount <= 1) throw lastAdministratorError();
  }

  await dependencies.setAdministratorActive(input.schoolId, input.administratorId, input.isActive);
}

export async function deleteAdministratorSafely(
  input: {schoolId: string; administratorId: string},
  dependencies: AdministratorLifecycleDependencies
) {
  const administrator = await dependencies.loadAdministrator(input.administratorId, input.schoolId);
  if (!administrator || administrator.schoolId !== input.schoolId) {
    throw new Error('Administrator is not available in this school');
  }

  if (administrator.isActive) {
    const activeCount = await dependencies.countActiveAdministrators(input.schoolId);
    if (activeCount <= 1) throw lastAdministratorError();
  }

  // The database RPC rechecks the last-active invariant after obtaining its
  // per-school lock, and rolls back account unlinking on any deletion error.
  await dependencies.deleteAdministratorWithAccountLinks(input.schoolId, input.administratorId);
}
