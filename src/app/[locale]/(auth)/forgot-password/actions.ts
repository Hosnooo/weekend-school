'use server';

import {headers} from 'next/headers';

import {passwordRecoverySchema} from '@/features/auth/auth.schemas';
import {buildPasswordRecoveryRedirect, requestPasswordRecovery} from '@/features/auth/password-recovery.service';
import {isLocale} from '@/i18n/config';
import {createServerSupabaseClient} from '@/lib/supabase/server';

export type RecoveryState = {status: 'idle' | 'invalid' | 'accepted' | 'unavailable'};

export async function requestRecoveryAction(_previous: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const localeValue = String(formData.get('locale') ?? 'en');
  const locale = isLocale(localeValue) ? localeValue : 'en';
  const parsed = passwordRecoverySchema.safeParse({email: formData.get('email')});
  if (!parsed.success) return {status: 'invalid'};

  let redirectTo: string;
  try {
    const requestHeaders = await headers();
    const origin = requestHeaders.get('origin');
    const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
    if (!origin || !host) throw new Error('Recovery origin is unavailable');
    redirectTo = buildPasswordRecoveryRedirect(origin, host, locale);
  } catch (error) {
    console.error('Password recovery configuration is unavailable', {error});
    return {status: 'unavailable'};
  }

  try {
    const supabase = await createServerSupabaseClient();
    // The recovery service deliberately gives the same public result for
    // existing and unknown emails and suppresses per-address provider failures.
    await requestPasswordRecovery(parsed.data.email, async (email) => {
      const {error} = await supabase.auth.resetPasswordForEmail(email, {redirectTo});
      if (error) throw error;
    });
  } catch (error) {
    console.error('Unable to initiate password recovery', {error});
    return {status: 'unavailable'};
  }
  return {status: 'accepted'};
}
