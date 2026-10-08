/** Only allowlisted categories are exposed to Administrator screens. */
export type AccountAccessError = 'accountUnavailable' | 'emailMissing' | 'rateLimited' | 'stale' | 'failed';

export function accountAccessError(error: unknown): AccountAccessError {
  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code) : '';
  const status = error && typeof error === 'object' && 'status' in error
    ? Number(error.status) : 0;
  const message = error instanceof Error ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String(error.message) : '';

  if (/login email is unavailable|valid login email is required/i.test(message)) {
    return 'emailMissing';
  }
  if (/another school|login profile is inactive/i.test(message)) {
    // Do not expose a different school's identity or account metadata.
    return 'accountUnavailable';
  }
  if (code === 'P0002' || /not available in this school/i.test(message)) {
    return 'stale';
  }
  if (status === 429 || /rate.limit|too many requests|email rate limit/i.test(message)) {
    return 'rateLimited';
  }
  return 'failed';
}
