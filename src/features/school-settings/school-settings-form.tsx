'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {FormField} from '@/components/ui/form-field';
import {Input} from '@/components/ui/input';
import {SelectField} from '@/components/ui/select-field';
import type {Locale} from '@/i18n/config';
import {initialActionState} from '@/lib/validation/action-state';

import {updateSchoolSettingsAction} from './school-settings.actions';
import type {SchoolSettingsInput} from './school-settings.schemas';

export function SchoolSettingsForm({
  locale,
  settings,
  saved
}: {
  locale: Locale;
  settings: SchoolSettingsInput;
  saved: boolean;
}) {
  const t = useTranslations('schoolSettings');
  const common = useTranslations('common');
  const language = useTranslations('language');
  const [state, action, pending] = useActionState(
    updateSchoolSettingsAction,
    initialActionState
  );

  return (
    <form
      action={action}
      className="settings-form settings-section-card school-settings-section"
    >
      <div className="settings-section-heading">
        <h2>{t('sectionTitle')}</h2>
        <p>{t('sectionHelp')}</p>
      </div>
      <input name="locale" type="hidden" value={locale} />

      {saved ? (
        <p className="form-success" role="status">
          {t('saved')}
        </p>
      ) : null}

      <div className="form-grid">
        <FormField htmlFor="school-name-en" label={t('nameEn')} required>
          <Input
            defaultValue={settings.nameEn}
            id="school-name-en"
            name="nameEn"
            required
          />
        </FormField>

        <FormField htmlFor="school-name-ar" label={t('nameAr')} required>
          <Input
            defaultValue={settings.nameAr}
            dir="rtl"
            id="school-name-ar"
            name="nameAr"
            required
          />
        </FormField>

        <FormField htmlFor="school-timezone" label={t('timezone')} required>
          <Input
            defaultValue={settings.timezone}
            id="school-timezone"
            list="school-timezones"
            name="timezone"
            required
          />
        </FormField>

        <datalist id="school-timezones">
          <option value="America/Edmonton" />
          <option value="America/Toronto" />
          <option value="UTC" />
        </datalist>

        <FormField
          htmlFor="school-default-language"
          label={t('defaultLanguage')}
          required
        >
          <SelectField
            defaultValue={settings.defaultLanguage}
            id="school-default-language"
            name="defaultLanguage"
          >
            <option value="en">{language('english')}</option>
            <option value="ar">{language('arabic')}</option>
          </SelectField>
        </FormField>
      </div>

      <FormFeedback state={state} />

      <div className="form-actions">
        <Button disabled={pending} type="submit">
          {pending ? common('saving') : common('save')}
        </Button>

        <Button disabled={pending} type="reset" variant="secondary">
          {common('cancel')}
        </Button>
      </div>
    </form>
  );
}
