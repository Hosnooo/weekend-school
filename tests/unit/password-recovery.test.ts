import {describe, expect, it} from 'vitest';

import {passwordRecoverySchema} from '@/features/auth/auth.schemas';
import {buildPasswordRecoveryRedirect, requestPasswordRecovery} from '@/features/auth/password-recovery.service';

describe('password recovery', () => {
  it('normalizes a valid address and rejects malformed input', () => {
    expect(passwordRecoverySchema.parse({email: ' User@Example.COM '}).email).toBe('user@example.com');
    expect(passwordRecoverySchema.safeParse({email: 'not-an-email'}).success).toBe(false);
  });

  it('returns one public outcome for known and unknown addresses', async () => {
    const sent: string[] = [];
    const known = await requestPasswordRecovery('known@example.com', async (email) => {sent.push(email);});
    const unknown = await requestPasswordRecovery('unknown@example.com', async (email) => {sent.push(email);});
    expect(known).toEqual(unknown);
    expect(sent).toEqual(['known@example.com', 'unknown@example.com']);
  });

  it('does not disclose a provider failure to the requester', async () => {
    const result = await requestPasswordRecovery('known@example.com', async () => {throw new Error('SMTP rejected');});
    expect(result).toEqual({status: 'accepted'});
  });

  it('accepts only a matching application origin for recovery links', () => {
    expect(buildPasswordRecoveryRedirect('https://weekend-school-nine.vercel.app', 'weekend-school-nine.vercel.app', 'ar'))
      .toBe('https://weekend-school-nine.vercel.app/ar/set-password');
    expect(() => buildPasswordRecoveryRedirect('https://attacker.example', 'weekend-school-nine.vercel.app', 'en'))
      .toThrow();
    expect(() => buildPasswordRecoveryRedirect('http://weekend-school-nine.vercel.app', 'weekend-school-nine.vercel.app', 'en'))
      .toThrow();
  });
});
