export type TeacherInvitationInput = {
  schoolId: string;
  displayName: string;
  email: string;
  preferredLanguage: 'en' | 'ar';
};

export type TeacherInvitationDependencies = {
  inviteAuthUser(input: TeacherInvitationInput): Promise<string>;
  createProfile(input: TeacherInvitationInput, authUserId: string): Promise<string>;
  deleteProfile(profileId: string): Promise<void>;
  deleteAuthUser(authUserId: string): Promise<void>;
  findUnclaimedAuthUser(email: string, schoolId: string): Promise<string | null>;
  sendExistingAccessLink(email: string): Promise<void>;
};

export type TeacherAccessDependencies = {
  findTeacher(profileId: string, schoolId: string): Promise<{authUserId: string; preferredLanguage: 'en' | 'ar'} | null>;
  getAuthEmail(authUserId: string): Promise<string | null>;
  sendAccessLink(email: string, language: 'en' | 'ar'): Promise<void>;
};

export async function resendTeacherAccess(profileId: string, schoolId: string, dependencies: TeacherAccessDependencies): Promise<void> {
  const teacher = await dependencies.findTeacher(profileId, schoolId);
  if (!teacher) throw new Error('Teacher account unavailable');
  const email = await dependencies.getAuthEmail(teacher.authUserId);
  if (!email) throw new Error('Teacher account unavailable');
  await dependencies.sendAccessLink(email, teacher.preferredLanguage);
}

export async function inviteTeacher(
  input: TeacherInvitationInput,
  dependencies: TeacherInvitationDependencies
) {
  const normalizedInput = {...input, email: input.email.trim().toLowerCase()};

  let authUserId: string;
  let newAuthUser = false;
  const existingAuthUserId = await dependencies.findUnclaimedAuthUser(
    normalizedInput.email,
    normalizedInput.schoolId
  );

  if (existingAuthUserId) {
    authUserId = existingAuthUserId;
  } else {
    authUserId = await dependencies.inviteAuthUser(normalizedInput);
    newAuthUser = true;
  }

  let profileId: string | null = null;
  try {
    profileId = await dependencies.createProfile(normalizedInput, authUserId);
    if (!newAuthUser) await dependencies.sendExistingAccessLink(normalizedInput.email);
    return profileId;
  } catch (error) {
    if (profileId) {
      try {
        await dependencies.deleteProfile(profileId);
      } catch {
        // Continue cleanup and preserve the operation's original error.
      }
    }

    if (newAuthUser) {
      try {
        await dependencies.deleteAuthUser(authUserId);
      } catch {
        // Cleanup is best effort; server logging belongs in the adapter.
      }
    }

    throw error;
  }
}
