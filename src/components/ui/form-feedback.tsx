'use client';

import {useLocale, useTranslations} from 'next-intl';

import {formatValidationIssue} from '@/lib/validation/error-guidance';
import type {ActionState} from '@/lib/validation/action-state';

export function FormFeedback({state}: {state: ActionState}) {
  const t = useTranslations('common');
  const locale = useLocale();
  if (!state.error) return null;
  const key = state.error === 'validation' ? 'validation'
    : state.error === 'invite' ? 'inviteError'
    : state.error === 'conflict' ? 'assignmentConflict'
    : state.error === 'transferConflict' ? 'transferConflict'
    : state.error === 'adminAccount' ? 'adminAccount'
    : state.error === 'teacherAccount' ? 'teacherAccount'
    : state.error === 'guardianAlreadyLinked' ? 'guardianAlreadyLinked'
    : state.error === 'duplicate' ? 'duplicate'
    : state.error === 'notFound' ? 'notFound'
    : state.error === 'rule' ? 'rule'
    : state.error === 'stale' ? 'stale'
    : state.error === 'permission' ? 'permission'
    : state.error === 'protectedHistory' ? 'protectedHistory'
    : 'saveError';
  return (
    <div aria-live="polite" className="form-error" role="alert">
      <p>{t(key)}</p>
      {state.error === 'validation' && state.issues?.length ? (
        <ul>
          {state.issues.map((issue, index) => (
            <li key={`${issue.field}-${issue.item ?? ''}-${index}`}>
              {formatValidationIssue(issue, locale)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
