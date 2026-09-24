import type {Profile} from '@/features/profiles/profile.types';

export class AuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export type AccountCapabilities = {
  isAdmin: boolean;
  teacherIds: string[];
};

export type TeachingContextRef = {
  classSubjectId: string;
  subjectGroupId: string | null;
};

export type AuthorizationDependencies = {
  loadProfile: () => Promise<Profile | null>;
  loadCapabilities: (profile: Profile) => Promise<AccountCapabilities>;
  canTeachContext: (
    profile: Profile,
    context: TeachingContextRef
  ) => Promise<boolean>;
};

export function assertActiveProfile(profile: Profile | null): Profile {
  if (!profile?.isActive) {
    throw new AuthorizationError();
  }

  return profile;
}

export function canAdmin(capabilities: AccountCapabilities): boolean {
  return capabilities.isAdmin;
}

export function canTeach(capabilities: AccountCapabilities): boolean {
  return capabilities.teacherIds.length > 0;
}

export async function requireAdmin(
  dependencies: AuthorizationDependencies
): Promise<Profile> {
  const profile = assertActiveProfile(await dependencies.loadProfile());
  const capabilities = await dependencies.loadCapabilities(profile);

  if (!canAdmin(capabilities)) {
    throw new AuthorizationError();
  }

  return profile;
}

export async function requireTeachingCapability(
  dependencies: AuthorizationDependencies
): Promise<{profile: Profile; teacherIds: string[]}> {
  const profile = assertActiveProfile(await dependencies.loadProfile());
  const capabilities = await dependencies.loadCapabilities(profile);

  if (!canTeach(capabilities)) {
    throw new AuthorizationError();
  }

  return {profile, teacherIds: capabilities.teacherIds};
}

export async function requireTeachingContextAccess(
  context: TeachingContextRef,
  dependencies: AuthorizationDependencies
): Promise<Profile> {
  const {profile} = await requireTeachingCapability(dependencies);

  if (!(await dependencies.canTeachContext(profile, context))) {
    throw new AuthorizationError();
  }

  return profile;
}
