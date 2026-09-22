'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import type {Locale} from '@/i18n/config';
import {initialActionState} from '@/lib/validation/action-state';

import {updateSchoolSettingsAction} from './school-settings.actions';
import type {SchoolSettingsInput} from './school-settings.schemas';

export function SchoolSettingsForm({locale, settings, saved}: {locale: Locale; settings: SchoolSettingsInput; saved: boolean}) {
  const t = useTranslations('schoolSettings');
  const common = useTranslations('common');
  const language = useTranslations('language');
  const [state, action, pending] = useActionState(updateSchoolSettingsAction, initialActionState);

  return <form action={action} className="record-form">
    <input name="locale" type="hidden" value={locale} />
    {saved ? <p role="status" className="form-success">{t('saved')}</p> : null}
    <div className="form-grid">
      <label>{t('nameEn')}<input name="nameEn" defaultValue={settings.nameEn} required /></label>
      <label>{t('nameAr')}<input name="nameAr" defaultValue={settings.nameAr} required dir="rtl" /></label>
      <label>{t('timezone')}<input name="timezone" defaultValue={settings.timezone} required list="school-timezones" /></label>
      <datalist id="school-timezones"><option value="America/Edmonton" /><option value="America/Toronto" /><option value="UTC" /></datalist>
      <label>{t('defaultLanguage')}<select name="defaultLanguage" defaultValue={settings.defaultLanguage}>
        <option value="en">{language('english')}</option>
        <option value="ar">{language('arabic')}</option>
      </select></label>
    </div>
    <FormFeedback state={state} />
    <div className="form-actions"><Button disabled={pending}>{pending ? common('saving') : common('save')}</Button></div>
  </form>;
}
