'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {
  addStudentGuardianAction,
  unlinkStudentGuardianAction,
  updateStudentGuardianAction
} from '@/features/guardians/guardian.actions';
import type {StudentGuardianLink} from '@/features/guardians/guardian.types';
import type {Locale} from '@/i18n/config';
import {initialActionState} from '@/lib/validation/action-state';

function GuardianEditor({
  locale,
  studentId,
  guardian
}: {
  locale: Locale;
  studentId: string;
  guardian: StudentGuardianLink;
}) {
  const t = useTranslations('guardians');
  const common = useTranslations('common');
  const languages = useTranslations('reportLanguages');
  const [state, action, pending] = useActionState(
    updateStudentGuardianAction,
    initialActionState
  );

  return (
    <details>
      <summary>{t('editGuardian')}</summary>
      <form action={action} className="record-form">
        <input name="locale" type="hidden" value={locale} />
        <input name="studentId" type="hidden" value={studentId} />
        <input name="guardianId" type="hidden" value={guardian.id} />

        <div className="form-grid">
          <label>
            {t('name')}
            <input defaultValue={guardian.name} name="name" required />
          </label>
          <label>
            {t('email')}
            <input
              autoComplete="email"
              defaultValue={guardian.email}
              name="email"
              required
              type="email"
            />
          </label>
          <label>
            {t('phone')}
            <input
              autoComplete="tel"
              defaultValue={guardian.phone ?? ''}
              name="phone"
              required
              type="tel"
            />
          </label>
          <label>
            {t('reportLanguage')}
            <select
              defaultValue={guardian.reportLanguage}
              name="reportLanguage"
            >
              <option value="en">{languages('en')}</option>
              <option value="ar">{languages('ar')}</option>
              <option value="both">{languages('both')}</option>
            </select>
          </label>
          <label>
            <input
              defaultChecked={guardian.isPrimary}
              name="isPrimary"
              type="checkbox"
            />{' '}
            {t('primaryGuardian')}
          </label>
          <label>
            <input
              defaultChecked={guardian.receivesReports}
              name="receivesReports"
              type="checkbox"
            />{' '}
            {t('receivesReports')}
          </label>
        </div>

        <p className="field-help">{t('sharedContactHelp')}</p>
        <FormFeedback state={state} />

        <Button disabled={pending} type="submit">
          {pending ? common('saving') : common('save')}
        </Button>
      </form>
    </details>
  );
}

export function StudentGuardianManager({
  locale,
  studentId,
  guardians
}: {
  locale: Locale;
  studentId: string;
  guardians: StudentGuardianLink[];
}) {
  const t = useTranslations('guardians');
  const common = useTranslations('common');
  const languages = useTranslations('reportLanguages');
  const [state, action, pending] = useActionState(
    addStudentGuardianAction,
    initialActionState
  );

  return (
    <div className="stack-list">
      {guardians.length === 0 ? <p>{t('noLinked')}</p> : (
        <div className="stack-list">
          {guardians.map((guardian) => (
            <div className="record-card stack-list" key={guardian.id}>
              <div>
                <strong>{guardian.name}</strong>
                {' '}
                {guardian.isPrimary ? (
                  <Badge variant="info">{t('primaryGuardian')}</Badge>
                ) : null}
              </div>

              <div>{guardian.email}</div>
              <div>
                <strong>{t('phone')}:</strong>{' '}
                {guardian.phone ?? common('none')}
              </div>
              <div>
                <strong>{t('reportLanguage')}:</strong>{' '}
                {languages(guardian.reportLanguage)}
              </div>

              {guardian.receivesReports ? (
                <Badge variant="success">{t('receivesReports')}</Badge>
              ) : null}

              <GuardianEditor
                guardian={guardian}
                locale={locale}
                studentId={studentId}
              />

              <form action={unlinkStudentGuardianAction}>
                <input name="locale" type="hidden" value={locale} />
                <input name="studentId" type="hidden" value={studentId} />
                <input name="guardianId" type="hidden" value={guardian.id} />
                <Button type="submit" variant="secondary">
                  {t('unlinkGuardian')}
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}

      <details>
        <summary>{t('addGuardianToStudent')}</summary>
        <form action={action} className="record-form">
          <input name="locale" type="hidden" value={locale} />
          <input name="studentId" type="hidden" value={studentId} />

          <div className="form-grid">
            <label>
              {t('name')}
              <input name="name" required />
            </label>
            <label>
              {t('email')}
              <input autoComplete="email" name="email" required type="email" />
            </label>
            <label>
              {t('phone')}
              <input autoComplete="tel" name="phone" required type="tel" />
            </label>
            <label>
              {t('reportLanguage')}
              <select defaultValue="en" name="reportLanguage">
                <option value="en">{languages('en')}</option>
                <option value="ar">{languages('ar')}</option>
                <option value="both">{languages('both')}</option>
              </select>
            </label>
            <label>
              <input
                defaultChecked={guardians.length === 0}
                name="isPrimary"
                type="checkbox"
              />{' '}
              {t('primaryGuardian')}
            </label>
            <label>
              <input
                defaultChecked
                name="receivesReports"
                type="checkbox"
              />{' '}
              {t('receivesReports')}
            </label>
          </div>

          <FormFeedback state={state} />

          <Button disabled={pending} type="submit">
            {pending ? common('saving') : t('addGuardianToStudent')}
          </Button>
        </form>
      </details>
    </div>
  );
}
