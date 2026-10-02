'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {FormField} from '@/components/ui/form-field';
import {Input} from '@/components/ui/input';
import type {Locale} from '@/i18n/config';
import {initialActionState} from '@/lib/validation/action-state';

import {ReportEmailTemplateEditor} from './report-email-template-editor';
import {saveReportTemplateAction} from './report-template.actions';
import type {ReportTemplateConfig} from './report-template.types';

export function ReportTemplateForm({
  locale,
  template,
  saved
}: {
  locale: Locale;
  template: ReportTemplateConfig;
  saved: boolean;
}) {
  const t = useTranslations('reportTemplate');
  const common = useTranslations('common');

  const [state, action, pending] = useActionState(
    saveReportTemplateAction,
    initialActionState
  );

  return (
    <form action={action} className="settings-form report-template-form">
      <input name="locale" type="hidden" value={locale} />

      {saved ? (
        <p className="form-success" role="status">
          {t('saved')}
        </p>
      ) : null}

      <section className="settings-section-card report-settings-section">
        <div className="settings-section-heading">
          <h2>{t('settingsSectionTitle')}</h2>
          <p>{t('settingsSectionHelp')}</p>
        </div>

        <div className="form-grid">
          <FormField
            htmlFor="report-template-name"
            label={t('name')}
            required
          >
            <Input
              defaultValue={template.name}
              id="report-template-name"
              name="name"
              required
            />
          </FormField>

          <FormField
            htmlFor="main-report-label-en"
            label={t('mainReportLabelEn')}
          >
            <Input
              defaultValue={template.mainReportLabelEn ?? ''}
              id="main-report-label-en"
              name="mainReportLabelEn"
            />
          </FormField>

          <FormField
            htmlFor="main-report-label-ar"
            label={t('mainReportLabelAr')}
          >
            <Input
              defaultValue={template.mainReportLabelAr ?? ''}
              dir="rtl"
              id="main-report-label-ar"
              name="mainReportLabelAr"
            />
          </FormField>

          <FormField
            htmlFor="main-report-help-en"
            label={t('mainReportHelpEn')}
          >
            <textarea
              defaultValue={template.mainReportHelpEn ?? ''}
              id="main-report-help-en"
              name="mainReportHelpEn"
              rows={3}
            />
          </FormField>

          <FormField
            htmlFor="main-report-help-ar"
            label={t('mainReportHelpAr')}
          >
            <textarea
              defaultValue={template.mainReportHelpAr ?? ''}
              dir="rtl"
              id="main-report-help-ar"
              name="mainReportHelpAr"
              rows={3}
            />
          </FormField>
        </div>

        <div className="settings-option-group">
          <label className="settings-toggle">
            <input
              defaultChecked={template.performanceEnabled}
              name="performanceEnabled"
              type="checkbox"
            />
            <span>{t('performanceEnabled')}</span>
          </label>

          <div className="form-grid">
            <FormField
              htmlFor="performance-label-en"
              label={t('performanceLabelEn')}
            >
              <Input
                defaultValue={template.performanceLabelEn ?? ''}
                id="performance-label-en"
                name="performanceLabelEn"
              />
            </FormField>

            <FormField
              htmlFor="performance-label-ar"
              label={t('performanceLabelAr')}
            >
              <Input
                defaultValue={template.performanceLabelAr ?? ''}
                dir="rtl"
                id="performance-label-ar"
                name="performanceLabelAr"
              />
            </FormField>
          </div>
        </div>

        <div className="settings-option-group">
          <label className="settings-toggle">
            <input
              defaultChecked={template.studentCommentsEnabled}
              name="studentCommentsEnabled"
              type="checkbox"
            />
            <span>{t('studentCommentsEnabled')}</span>
          </label>

          <div className="form-grid">
            <FormField
              htmlFor="student-comment-label-en"
              label={t('studentCommentLabelEn')}
            >
              <Input
                defaultValue={template.studentCommentLabelEn ?? ''}
                id="student-comment-label-en"
                name="studentCommentLabelEn"
              />
            </FormField>

            <FormField
              htmlFor="student-comment-label-ar"
              label={t('studentCommentLabelAr')}
            >
              <Input
                defaultValue={template.studentCommentLabelAr ?? ''}
                dir="rtl"
                id="student-comment-label-ar"
                name="studentCommentLabelAr"
              />
            </FormField>

            <FormField
              htmlFor="student-comment-help-en"
              label={t('studentCommentHelpEn')}
            >
              <textarea
                defaultValue={template.studentCommentHelpEn ?? ''}
                id="student-comment-help-en"
                name="studentCommentHelpEn"
                rows={3}
              />
            </FormField>

            <FormField
              htmlFor="student-comment-help-ar"
              label={t('studentCommentHelpAr')}
            >
              <textarea
                defaultValue={template.studentCommentHelpAr ?? ''}
                dir="rtl"
                id="student-comment-help-ar"
                name="studentCommentHelpAr"
                rows={3}
              />
            </FormField>
          </div>
        </div>

        <div className="settings-option-group">
          <h3>{t('reportOpeningClosing')}</h3>
          <div className="form-grid">
            {[
              ['introEn', 'introEn', template.introEn, false],
              ['introAr', 'introAr', template.introAr, true],
              ['closingEn', 'closingEn', template.closingEn, false],
              ['closingAr', 'closingAr', template.closingAr, true]
            ].map(([id, key, value, rtl]) => (
              <FormField
                htmlFor={`report-template-${id}`}
                key={String(id)}
                label={t(String(key))}
              >
                <textarea
                  defaultValue={String(value ?? '')}
                  dir={rtl ? 'rtl' : undefined}
                  id={`report-template-${id}`}
                  name={String(id)}
                  rows={3}
                />
              </FormField>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section-card email-settings-section">
        <div className="settings-section-heading">
          <h2>{t('emailSectionTitle')}</h2>
          <p>{t('emailSectionHelp')}</p>
        </div>

        <ReportEmailTemplateEditor template={template} />
      </section>

      <FormFeedback state={state} />

      <div className="form-actions settings-save-bar">
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
