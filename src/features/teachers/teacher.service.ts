export type TeacherBusinessInput = {
  schoolId: string;
  displayName: string;
  email: string;
  preferredLanguage: 'en' | 'ar';
};

export type TeacherAccountLink = {
  schoolId: string;
  teacherId: string;
  profileId: string;
};

export type TeacherBusinessRecordDependencies = {
  createTeacher(input: TeacherBusinessInput): Promise<string>;
  lookupAuthByEmail?: (email: string) => Promise<unknown>;
  lookupGuardianByEmail?: (email: string) => Promise<unknown>;
  linkTeacherAccount?: (input: TeacherAccountLink) => Promise<void>;
};

export type TeacherAccessDependencies = {
  loadTeacher(
    teacherId: string,
    schoolId: string
  ): Promise<{
    id: string;
    schoolId: string;
    displayName: string;
    preferredLanguage: 'en' | 'ar';
  } | null>;
  findAuthUserByEmail(email: string): Promise<{id: string} | null>;
  findProfileByAuthUserId(authUserId: string): Promise<{id: string; schoolId: string} | null>;
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
  linkTeacherAccount(input: TeacherAccountLink): Promise<void>;
  sendAccessLink(email: string, redirectTo: string): Promise<void>;
  deleteProfile?: (profileId: string) => Promise<void>;
  deleteAuthUser?: (authUserId: string) => Promise<void>;
  removeAdministratorAccount?: (input: {schoolId: string; profileId: string}) => Promise<void>;
};

export type UnlinkTeacherAccessDependencies = {
  unlinkTeacherAccount(input: TeacherAccountLink): Promise<void>;
  deleteProfile?: (profileId: string) => Promise<void>;
  removeAdministratorAccount?: (input: {schoolId: string; profileId: string}) => Promise<void>;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function assertLoginEmail(email: string) {
  if (!email || !email.includes('@')) throw new Error('A valid login email is required');
}

export async function createTeacherBusinessRecord(
  input: TeacherBusinessInput,
  dependencies: TeacherBusinessRecordDependencies
) {
  return dependencies.createTeacher({...input, email: normalizeEmail(input.email)});
}

export async function ensureTeacherAccess(
  input: {
    schoolId: string;
    teacherId: string;
    loginEmail: string;
    redirectTo: string;
  },
  dependencies: TeacherAccessDependencies
) {
  const loginEmail = normalizeEmail(input.loginEmail);
  assertLoginEmail(loginEmail);

  const teacher = await dependencies.loadTeacher(input.teacherId, input.schoolId);
  if (!teacher || teacher.schoolId !== input.schoolId) {
    throw new Error('Teacher is not available in this school');
  }

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
    if (profile) {
      profileId = profile.id;
    } else {
      profileId = await dependencies.createProfile({
        schoolId: input.schoolId,
        authUserId,
        displayName: teacher.displayName,
        preferredLanguage: teacher.preferredLanguage
      });
      createdProfile = true;
    }
  } else {
    authUserId = await dependencies.inviteAuthUser({
      email: loginEmail,
      displayName: teacher.displayName,
      preferredLanguage: teacher.preferredLanguage,
      redirectTo: input.redirectTo
    });
    createdAuth = true;
    try {
      profileId = await dependencies.createProfile({
        schoolId: input.schoolId,
        authUserId,
        displayName: teacher.displayName,
        preferredLanguage: teacher.preferredLanguage
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
    await dependencies.linkTeacherAccount({
      schoolId: input.schoolId,
      teacherId: input.teacherId,
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

  if (existingAuth) {
    await dependencies.sendAccessLink(loginEmail, input.redirectTo);
  }

  return profileId;
}

export async function unlinkTeacherAccess(
  input: TeacherAccountLink,
  dependencies: UnlinkTeacherAccessDependencies
) {
  await dependencies.unlinkTeacherAccount(input);
}
