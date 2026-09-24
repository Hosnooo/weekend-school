'use client';

import Link from 'next/link';
import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {TextInput} from '@/components/ui/text-input';
import type {Locale} from '@/i18n/config';

import {requestRecoveryAction, type RecoveryState} from './actions';

const initialState: RecoveryState = {status: 'idle'};

export function ForgotPasswordForm({locale}: {locale: Locale}) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState(requestRecoveryAction, initialState);

  return (
    <form action={action} className="login-form">
      <input name="locale" type="hidden" value={locale} />
      <label htmlFor="recovery-email">{t('email')}</label>
      <TextInput
        autoComplete="email"
        id="recovery-email"
        name="email"
        required
        type="email"
      />
      {state.status === 'invalid' ? (
        <p className="form-error" role="alert">{t('invalidEmail')}</p>
      ) : null}
      {state.status === 'accepted' ? (
        <p aria-live="polite" role="status">{t('recoveryAccepted')}</p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? t('sendingRecovery') : t('sendRecovery')}
      </Button>
      <Link href={`/${locale}/login`}>{t('backToSignIn')}</Link>
    </form>
  );
}
