import type {Profile} from '@/features/profiles/profile.types';
import type {AppRole} from '@/lib/auth/navigation';

export class AuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export type TeachingContextRef = {
  classSubjectId: string;
  subjectGroupId: string | null;
};

export type AuthorizationDependencies = {
  loadProfile: () => Promise<Profile | null>;
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

export function assertRole(profile: Profile, requiredRole: AppRole): Profile {
  if (profile.role !== requiredRole) {
    throw new AuthorizationError();
  }

  return profile;
}

export function assertTeachingProfile(profile: Profile): Profile {
  return assertActiveProfile(profile);
}

export async function requireAdmin(
  dependencies: AuthorizationDependencies
): Promise<Profile> {
  const profile = assertActiveProfile(await dependencies.loadProfile());
  return assertRole(profile, 'ADMIN');
}

export async function requireTeachingContextAccess(
  context: TeachingContextRef,
  dependencies: AuthorizationDependencies
): Promise<Profile> {
  const profile = assertActiveProfile(await dependencies.loadProfile());

  if (!(await dependencies.canTeachContext(profile, context))) {
    throw new AuthorizationError();
  }

  return profile;
}
