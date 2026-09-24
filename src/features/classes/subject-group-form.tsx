'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {FormField} from '@/components/ui/form-field';
import {createSubjectGroupAction} from '@/features/classes/class.actions';
import type {Locale} from '@/i18n/config';
import {initialActionState} from '@/lib/validation/action-state';

export function SubjectGroupForm({
  locale,
  classId,
  classSubjectId
}: {
  locale: Locale;
  classId: string;
  classSubjectId: string;
}) {
  const t = useTranslations('classes');
  const common = useTranslations('common');
  const [state, action, pending] = useActionState(
    createSubjectGroupAction,
    initialActionState
  );

  return (
    <form action={action} className="record-form compact-form">
      <input name="locale" type="hidden" value={locale} />
      <input name="classId" type="hidden" value={classId} />
      <input name="classSubjectId" type="hidden" value={classSubjectId} />
      <div className="form-grid">
        <FormField htmlFor={`group-name-en-${classSubjectId}`} label={t('groupNameEn')}>
          <input id={`group-name-en-${classSubjectId}`} name="nameEn" required />
        </FormField>
        <FormField htmlFor={`group-name-ar-${classSubjectId}`} label={t('groupNameAr')}>
          <input id={`group-name-ar-${classSubjectId}`} dir="rtl" name="nameAr" />
        </FormField>
      </div>
      <FormFeedback state={state} />
      <Button disabled={pending} type="submit">
        {pending ? common('saving') : t('addGroup')}
      </Button>
    </form>
  );
}
