'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {
  createGuardianAction,
  updateGuardianAction
} from '@/features/guardians/guardian.actions';
import type {GuardianListItem} from '@/features/guardians/guardian.types';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {initialActionState} from '@/lib/validation/action-state';

export function GuardianForm({
  locale,
  guardian,
  cancelHref = '/guardians'
}: {
  locale: Locale;
  guardian?: GuardianListItem;
  cancelHref?: string;
}) {
  const t = useTranslations('guardians');
  const common = useTranslations('common');
  const [state, action, pending] = useActionState(
    guardian ? updateGuardianAction : createGuardianAction,
    initialActionState
  );

  return (
    <form action={action} className="record-form">
      <input name="locale" type="hidden" value={locale} />
      {guardian ? <input name="id" type="hidden" value={guardian.id} /> : null}
      <input
        name="reportLanguage"
        type="hidden"
        value={guardian?.reportLanguage ?? 'both'}
      />

      <div className="form-grid">
        <label>
          {t('name')}
          <input defaultValue={guardian?.name} name="name" required />
        </label>
        <label>
          {t('email')}
          <input
            autoComplete="email"
            defaultValue={guardian?.email}
            name="email"
            required
            type="email"
          />
        </label>
        <label>
          {t('phone')}
          <input
            autoComplete="tel"
            defaultValue={guardian?.phone ?? ''}
            name="phone"
            required
            type="tel"
          />
        </label>
      </div>

      <FormFeedback state={state} />

      <div className="form-actions">
        <Button disabled={pending}>
          {pending ? common('saving') : common('save')}
        </Button>
        <Link
          className="button button-secondary action-link"
          href={cancelHref}
        >
          {common('cancel')}
        </Link>
      </div>
    </form>
  );
}
