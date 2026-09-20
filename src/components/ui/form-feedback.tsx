'use client';

import {useTranslations} from 'next-intl';

import type {ActionState} from '@/lib/validation/action-state';

export function FormFeedback({state}: {state: ActionState}) {
  const t = useTranslations('common');
  if (!state.error) return null;
  const key = state.error === 'validation' ? 'validation' : state.error === 'invite' ? 'inviteError' : 'saveError';
  return <p aria-live="polite" className="form-error" role="alert">{t(key)}</p>;
}
