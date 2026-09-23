'use client';

import Link from 'next/link';
import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {TextInput} from '@/components/ui/text-input';
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
      <TextInput
        autoComplete="email"
        id="email"
        label={translations('email')}
        name="email"
        required
        type="email"
      />
      <TextInput
        autoComplete="current-password"
        id="password"
        label={translations('password')}
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
