'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {FormField} from '@/components/ui/form-field';
import {createClassAction} from '@/features/classes/class.actions';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {initialActionState} from '@/lib/validation/action-state';

export function ClassForm({locale}: {locale: Locale}) {
  const t = useTranslations('classes');
  const common = useTranslations('common');
  const [state, action, pending] = useActionState(
    createClassAction,
    initialActionState
  );

  return (
    <form action={action} className="record-form">
      <input name="locale" type="hidden" value={locale} />
      <div className="form-grid">
        <FormField htmlFor="class-name-en" label={t('nameEn')}>
          <input id="class-name-en" name="nameEn" required />
        </FormField>
        <FormField htmlFor="class-name-ar" label={t('nameAr')}>
          <input id="class-name-ar" dir="rtl" name="nameAr" />
        </FormField>
      </div>
      <FormFeedback state={state} />
      <div className="form-actions">
        <Button disabled={pending} type="submit">
          {pending ? common('saving') : common('save')}
        </Button>
        <Link className="button button-secondary action-link" href="/classes">
          {common('cancel')}
        </Link>
      </div>
    </form>
  );
}
