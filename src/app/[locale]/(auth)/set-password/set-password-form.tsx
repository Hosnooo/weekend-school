'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {z} from 'zod';

import {Button} from '@/components/ui/button';
import {TextInput} from '@/components/ui/text-input';
import type {Locale} from '@/i18n/config';
import {getDefaultAuthenticatedRoute} from '@/lib/auth/navigation';
import {createBrowserSupabaseClient} from '@/lib/supabase/browser';

const passwordSchema = z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/);

export function SetPasswordForm({locale}: {locale: Locale}) {
  const t = useTranslations('auth');
  const router = useRouter();
  const db = useMemo(() => createBrowserSupabaseClient(), []);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [linkVerification, setLinkVerification] = useState<{tokenHash: string; type: 'recovery' | 'invite'} | null>(null);
  const [verifyingLink, setVerifyingLink] = useState(false);
  const [error, setError] = useState<'invalid' | 'password' | 'samePassword' | null>(null);

  useEffect(() => {
    let active = true;
    let invalidTimer: ReturnType<typeof setTimeout> | undefined;
    const code = new URLSearchParams(window.location.search).get('code');
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const linkError = hash.get('error') || hash.get('error_code');
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const tokenHash = hash.get('token_hash');
    const otpType = hash.get('type');

    if (linkError) {
      // Respond asynchronously to the URL state and cancel on unmount.
      const invalidLinkTimer = setTimeout(() => {
        if (active) setError('invalid');
      }, 0);
      return () => {
        active = false;
        clearTimeout(invalidLinkTimer);
      };
    }

    if (tokenHash !== null) {
      // Landing here must not consume the single-use token. Email scanners can
      // open links, so only an explicit click may verify recovery/invite OTPs.
      const selectionTimer = setTimeout(() => {
        if (!active) return;
        if (tokenHash && (otpType === 'recovery' || otpType === 'invite')) {
          setLinkVerification({tokenHash, type: otpType});
        } else {
          setError('invalid');
        }
      }, 0);
      return () => {
        active = false;
        clearTimeout(selectionTimer);
      };
    }

    const accept = (hasSession: boolean) => {
      if (!active) return;
      if (hasSession) {
        if (invalidTimer) clearTimeout(invalidTimer);
        setError(null);
        setReady(true);
        return;
      }
      invalidTimer = setTimeout(() => {
        if (active) setError('invalid');
      }, 1500);
    };

    const {
      data: {subscription}
    } = db.auth.onAuthStateChange((_event, session) => accept(Boolean(session)));
    const establish = code
      ? db.auth.exchangeCodeForSession(code)
      : accessToken && refreshToken
        ? db.auth.setSession({access_token: accessToken, refresh_token: refreshToken})
        : db.auth.getSession();

    establish
      .then(({data}) => accept(Boolean(data.session)))
      .catch(() => accept(false));

    return () => {
      active = false;
      if (invalidTimer) clearTimeout(invalidTimer);
      subscription.unsubscribe();
    };
  }, [db]);

  async function verifyLink() {
    if (!linkVerification || verifyingLink) return;
    setVerifyingLink(true);
    try {
      const {data, error: verifyError} = await db.auth.verifyOtp({
        token_hash: linkVerification.tokenHash,
        type: linkVerification.type
      });
      // Strip the bearer-like one-time token from browser history on either
      // outcome. Never put it in logs, server requests, or a query parameter.
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search
      );
      setLinkVerification(null);
      if (verifyError || !data.session) {
        setError('invalid');
        return;
      }
      setReady(true);
      setError(null);
    } catch {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search
      );
      setLinkVerification(null);
      setError('invalid');
    } finally {
      setVerifyingLink(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = passwordSchema.safeParse(form.get('password'));
    if (!parsed.success) {
      setError('password');
      return;
    }

    setPending(true);
    setError(null);
    const {error: updateError} = await db.auth.updateUser({password: parsed.data});
    if (updateError) {
      setError(updateError.code === 'same_password' ? 'samePassword' : 'password');
      setPending(false);
      return;
    }

    const {
      data: {user},
      error: userError
    } = await db.auth.getUser();
    if (userError || !user) {
      setError('invalid');
      setPending(false);
      return;
    }

    const {data: profile, error: profileError} = await db
      .from('profiles')
      .select('is_active')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (profileError || !profile?.is_active) {
      setError('invalid');
      setPending(false);
      return;
    }

    const [administratorResult, teacherResult] = await Promise.all([
      db.rpc('is_admin'),
      db.rpc('current_teacher_ids')
    ]);
    const teacherIds = Array.isArray(teacherResult.data)
      ? teacherResult.data.filter((value): value is string => typeof value === 'string')
      : [];
    const destination = getDefaultAuthenticatedRoute({
      isAdmin: administratorResult.data === true,
      teacherIds
    });

    if (administratorResult.error || teacherResult.error || !destination) {
      setError('invalid');
      setPending(false);
      return;
    }

    router.replace(`/${locale}${destination}`);
    router.refresh();
  }

  if (error === 'invalid') {
    return (
      <>
        <p className="form-error" role="alert">
          {t('invalidInvitation')}
        </p>
        <Link href={`/${locale}/forgot-password`}>{t('requestNewLink')}</Link>
      </>
    );
  }

  if (linkVerification) {
    return (
      <div className="login-form">
        <p className="form-hint">{t('verifyPasswordLinkHint')}</p>
        <Button disabled={verifyingLink} onClick={() => void verifyLink()} type="button">
          {verifyingLink ? t('verifyingPasswordLink') : t('verifyPasswordLink')}
        </Button>
      </div>
    );
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="new-password">{t('newPassword')}</label>
      <TextInput
        autoComplete="new-password"
        disabled={!ready || pending}
        id="new-password"
        minLength={8}
        name="password"
        required
        type="password"
      />
      <p className="form-hint">{t('passwordRequirements')}</p>
      {error === 'password' ? (
        <p className="form-error" role="alert">
          {t('passwordUpdateError')}
        </p>
      ) : null}
      {error === 'samePassword' ? (
        <p className="form-error" role="alert">
          {t('passwordMustBeDifferent')}
        </p>
      ) : null}
      <Button disabled={!ready || pending} type="submit">
        {pending ? t('settingPassword') : t('setPassword')}
      </Button>
    </form>
  );
}
