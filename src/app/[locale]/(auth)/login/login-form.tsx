'use client';

import Link from 'next/link';
import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import type {LoginState} from '@/features/auth/auth.types';
import type {Locale} from '@/i18n/config';

import {loginAction} from './actions';

const initialState: LoginState = {error: null};

export function LoginForm({locale}: {locale: Locale}) {
  const translations = useTranslations('auth');
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="login-form">
      <input name="locale" type="hidden" value={locale} />
      <label htmlFor="email">{translations('email')}</label>
      <input
        autoComplete="email"
        id="email"
        name="email"
        required
        type="email"
      />
      <label htmlFor="password">{translations('password')}</label>
      <input
        autoComplete="current-password"
        id="password"
        name="password"
        required
        type="password"
      />
      {state.error ? (
        <p aria-live="polite" className="form-error" role="alert">
          {translations(state.error)}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? translations('signingIn') : translations('signIn')}
      </Button>
      <Link href={`/${locale}/forgot-password`}>{translations('forgotPassword')}</Link>
    </form>
  );
}
