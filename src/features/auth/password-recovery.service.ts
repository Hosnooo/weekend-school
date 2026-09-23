import {passwordRecoverySchema} from '@/features/auth/auth.schemas';

export function buildPasswordRecoveryRedirect(origin: string, host: string, locale: 'en' | 'ar'): string {
  const url = new URL(origin);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.host !== host || (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Untrusted password recovery origin');
  }
  return `${url.origin}/${locale}/set-password`;
}

export async function requestPasswordRecovery(
  email: string,
  sendLink: (normalizedEmail: string) => Promise<void>
): Promise<{status: 'accepted'}> {
  const parsed = passwordRecoverySchema.parse({email});
  try {
    await sendLink(parsed.email);
  } catch (error) {
    console.error('Password recovery email could not be sent', {error});
  }
  return {status: 'accepted'};
}
