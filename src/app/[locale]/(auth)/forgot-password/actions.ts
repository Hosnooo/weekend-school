'use server';

import {headers} from 'next/headers';

import {passwordRecoverySchema} from '@/features/auth/auth.schemas';
import {buildPasswordRecoveryRedirect, requestPasswordRecovery} from '@/features/auth/password-recovery.service';
import {isLocale} from '@/i18n/config';
import {createServerSupabaseClient} from '@/lib/supabase/server';

export type RecoveryState = {status: 'idle' | 'invalid' | 'accepted'};

export async function requestRecoveryAction(_previous: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const localeValue = String(formData.get('locale') ?? 'en');
  const locale = isLocale(localeValue) ? localeValue : 'en';
  const parsed = passwordRecoverySchema.safeParse({email: formData.get('email')});
  if (!parsed.success) return {status: 'invalid'};

  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  if (!origin || !host) throw new Error('Recovery origin is unavailable');
  const redirectTo = buildPasswordRecoveryRedirect(origin, host, locale);
  const supabase = await createServerSupabaseClient();
  await requestPasswordRecovery(parsed.data.email, async (email) => {
    const {error} = await supabase.auth.resetPasswordForEmail(email, {redirectTo});
    if (error) throw error;
  });
  return {status: 'accepted'};
}
