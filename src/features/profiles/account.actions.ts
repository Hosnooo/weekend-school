'use server';

import {createClient} from '@supabase/supabase-js';

import {ownEmailSchema, ownNameSchema, validateOwnPassword, type AccountResult} from './account.schema';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {getPublicEnv} from '@/lib/env/public';

export async function changeOwnNameAction(formData: FormData): Promise<AccountResult> {
  const name = ownNameSchema.safeParse(formData.get('displayName'));
  if (!name.success) return {status: 'error', reason: 'nameInvalid'};

  const db = await createServerSupabaseClient();
  const {data: {user}, error: identityError} = await db.auth.getUser();
  if (identityError || !user) return {status: 'error', reason: 'signInRequired'};

  // RLS and the auth_user_id filter restrict this to the caller's own profile.
  const {data, error} = await db.from('profiles').update({display_name: name.data})
    .eq('auth_user_id', user.id).eq('is_active', true).select('id').maybeSingle();
  if (error || !data) return {status: 'error', reason: 'nameUnavailable'};
  return {status: 'success'};
}

export async function requestOwnEmailChangeAction(formData: FormData): Promise<AccountResult> {
  const email = ownEmailSchema.safeParse(formData.get('newEmail'));
  if (!email.success) return {status: 'error', reason: 'invalidEmail'};
  const db = await createServerSupabaseClient();
  const {data: {user}, error: identityError} = await db.auth.getUser();
  if (identityError || !user) return {status: 'error', reason: 'signInRequired'};

  const {data: profile} = await db.from('profiles').select('id').eq('auth_user_id', user.id)
    .eq('is_active', true).maybeSingle();
  if (!profile) return {status: 'error', reason: 'signInRequired'};

  if (user.email?.toLowerCase() === email.data.toLowerCase()) {
    return {status: 'error', reason: 'sameEmail'};
  }
  // Hosted Supabase sends confirmation mail(s). The active email does not
  // change until the verification requirements have been satisfied.
  // Use the configured canonical Site URL; no untrusted redirect is accepted.
  const {error} = await db.auth.updateUser({email: email.data});
  if (error) return {status: 'error', reason: 'emailUnavailable'};
  return {status: 'sent'};
}

export async function changeOwnPasswordAction(formData: FormData): Promise<AccountResult> {
  const parsed = validateOwnPassword({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword')
  });
  if (!parsed.success) return {status: 'error', reason: parsed.reason};

  const db = await createServerSupabaseClient();
  const {data: {user}, error: identityError} = await db.auth.getUser();
  if (identityError || !user) return {status: 'error', reason: 'signInRequired'};
  if (!user.email) return {status: 'error', reason: 'passwordUnavailable'};

  const {data: profile} = await db.from('profiles').select('id').eq('auth_user_id', user.id)
    .eq('is_active', true).maybeSingle();
  if (!profile) return {status: 'error', reason: 'signInRequired'};

  // Verify the old password in a separate nonpersistent session. Do not sign in
  // through the user's existing session, log credentials, or use a service role.
  const {supabaseUrl, supabaseAnonKey} = getPublicEnv();
  const verifier = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}
  });
  try {
    const {data, error} = await verifier.auth.signInWithPassword({
      email: user.email, password: parsed.values.currentPassword
    });
    if (error || data.user?.id !== user.id) {
      return {status: 'error', reason: error?.code === 'invalid_credentials'
        ? 'incorrectPassword' : 'passwordUnavailable'};
    }

    const {error: updateError} = await db.auth.updateUser({
      password: parsed.values.newPassword,
      current_password: parsed.values.currentPassword
    });
    if (!updateError) return {status: 'success'};
    if (updateError.code === 'same_password') return {status: 'error', reason: 'samePassword'};
    if (updateError.code === 'weak_password') return {status: 'error', reason: 'invalidPassword'};
    return {status: 'error', reason: 'passwordUnavailable'};
  } catch {
    return {status: 'error', reason: 'passwordUnavailable'};
  } finally {
    // The temporary verifier's local-only signout must not revoke all sessions.
    try {await verifier.auth.signOut({scope: 'local'});} catch {}
  }
}
