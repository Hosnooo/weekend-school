import type {Profile} from '@/features/profiles/profile.types';
import type {AppRole} from '@/lib/auth/navigation';

export class AuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

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
