'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {FormField} from '@/components/ui/form-field';
import {
  addClassSubjectAction,
  createSubjectAction
} from '@/features/classes/class.actions';
import type {SubjectOption} from '@/features/classes/class.types';
import type {Locale} from '@/i18n/config';
import {initialActionState} from '@/lib/validation/action-state';

export function ClassSubjectForm({
  locale,
  classId,
  subjects
}: {
  locale: Locale;
  classId: string;
  subjects: SubjectOption[];
}) {
  const t = useTranslations('classes');
  const common = useTranslations('common');
  const [addState, addAction, addPending] = useActionState(
    addClassSubjectAction,
    initialActionState
  );
  const [createState, createAction, createPending] = useActionState(
    createSubjectAction,
    initialActionState
  );
  const subjectName = (subject: SubjectOption) =>
    locale === 'ar' && subject.nameAr ? subject.nameAr : subject.nameEn;

  return (
    <div className="stack-section">
      {subjects.length > 0 ? (
        <form action={addAction} className="inline-form-card">
          <input name="locale" type="hidden" value={locale} />
          <input name="classId" type="hidden" value={classId} />
          <FormField htmlFor="existing-subject" label={t('selectSubject')}>
            <select id="existing-subject" name="subjectId" required defaultValue="">
              <option disabled value="">
                {t('selectSubject')}
              </option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subjectName(subject)}
                </option>
              ))}
            </select>
          </FormField>
          <FormFeedback state={addState} />
          <Button disabled={addPending} type="submit">
            {addPending ? common('saving') : t('addSubject')}
          </Button>
        </form>
      ) : null}

      <details className="disclosure-card">
        <summary>{t('createSubject')}</summary>
        <form action={createAction} className="record-form compact-form">
          <input name="locale" type="hidden" value={locale} />
          <input name="classId" type="hidden" value={classId} />
          <div className="form-grid">
            <FormField htmlFor="subject-name-en" label={t('subjectNameEn')}>
              <input id="subject-name-en" name="nameEn" required />
            </FormField>
            <FormField htmlFor="subject-name-ar" label={t('subjectNameAr')}>
              <input id="subject-name-ar" dir="rtl" name="nameAr" />
            </FormField>
          </div>
          <FormFeedback state={createState} />
          <Button disabled={createPending} type="submit">
            {createPending ? common('saving') : t('createAndAddSubject')}
          </Button>
        </form>
      </details>
    </div>
  );
}
