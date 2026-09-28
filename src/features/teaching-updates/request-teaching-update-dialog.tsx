'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {Dialog, DialogClose} from '@/components/ui/dialog';
import {
  requestAdminTeachingUpdateAction as requestTeachingUpdateAction
} from './admin-teaching-update.actions';
import type {AdminTeachingUpdateContext} from './admin-teaching-update.types';

export function RequestTeachingUpdateDialog({
  contexts,
  locale
}: {
  contexts: AdminTeachingUpdateContext[];
  locale: string;
}) {
  const t = useTranslations('adminTeachingUpdates');
  const [coverageKind, setCoverageKind] =
    useState<'RANGE' | 'DATES'>('RANGE');

  const localName = (en: string, ar: string | null) =>
    locale === 'ar' && ar ? ar : en;

  return (
    <Dialog
      title={t('requestTitle')}
      trigger={<Button>{t('requestUpdate')}</Button>}
    >
      <form action={requestTeachingUpdateAction} className="stack">
        <input name="locale" type="hidden" value={locale}/>

        <label>
          <span>{t('classSubject')}</span>
          <select defaultValue="" name="classSubjectId" required>
            <option disabled value="">
              {t('chooseClassSubject')}
            </option>
            {contexts.map((context) => (
              <option
                key={context.classSubjectId}
                value={context.classSubjectId}
              >
                {localName(context.classNameEn, context.classNameAr)}
                {' — '}
                {localName(context.subjectNameEn, context.subjectNameAr)}
                {' · '}
                {t('activeGroups', {count: context.activeGroupCount})}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{t('coverage')}</span>
          <select
            name="coverageKind"
            value={coverageKind}
            onChange={(event) =>
              setCoverageKind(event.target.value as 'RANGE' | 'DATES')
            }
          >
            <option value="RANGE">{t('range')}</option>
            <option value="DATES">{t('exactDates')}</option>
          </select>
        </label>

        {coverageKind === 'RANGE' ? (
          <div className="form-grid">
            <label>
              <span>{t('periodStart')}</span>
              <input name="periodStart" type="date"/>
            </label>
            <label>
              <span>{t('periodEnd')}</span>
              <input name="periodEnd" type="date"/>
            </label>
          </div>
        ) : (
          <label>
            <span>{t('dates')}</span>
            <textarea
              name="dates"
              placeholder="2026-09-01, 2026-09-08"
              rows={3}
            />
          </label>
        )}

        <label>
          <span>{t('adminNote')}</span>
          <textarea name="adminNote" rows={3}/>
        </label>

        <div style={{display: 'flex', gap: '0.75rem', justifyContent: 'flex-end'}}>
          <DialogClose>{t('close')}</DialogClose>
          <Button type="submit">{t('request')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
