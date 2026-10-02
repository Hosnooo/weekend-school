'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormField} from '@/components/ui/form-field';
import {Input} from '@/components/ui/input';

import {
  buildReportEmailTemplatePreview,
  emailTemplateDisplayTokens,
  toEmailTemplateDisplayValue,
  toStoredEmailTemplateValue,
  type EmailTemplateLanguage
} from './report-email-template-preview';
import type {ReportTemplateConfig} from './report-template.types';

type EmailFieldName =
  | 'emailSubjectEn'
  | 'emailSubjectAr'
  | 'emailGreetingEn'
  | 'emailGreetingAr'
  | 'emailMessageEn'
  | 'emailMessageAr'
  | 'emailClosingEn'
  | 'emailClosingAr'
  | 'emailSignoffEn'
  | 'emailSignoffAr';

type EditorValues = Record<EmailFieldName, string>;

function languageForField(
  field: EmailFieldName
): EmailTemplateLanguage {
  return field.endsWith('Ar') ? 'ar' : 'en';
}

function initialValues(
  template: ReportTemplateConfig
): EditorValues {
  return {
    emailSubjectEn: toEmailTemplateDisplayValue(
      template.emailSubjectEn,
      'en'
    ),
    emailSubjectAr: toEmailTemplateDisplayValue(
      template.emailSubjectAr,
      'ar'
    ),
    emailGreetingEn: toEmailTemplateDisplayValue(
      template.emailGreetingEn,
      'en'
    ),
    emailGreetingAr: toEmailTemplateDisplayValue(
      template.emailGreetingAr,
      'ar'
    ),
    emailMessageEn: toEmailTemplateDisplayValue(
      template.emailMessageEn,
      'en'
    ),
    emailMessageAr: toEmailTemplateDisplayValue(
      template.emailMessageAr,
      'ar'
    ),
    emailClosingEn: toEmailTemplateDisplayValue(
      template.emailClosingEn,
      'en'
    ),
    emailClosingAr: toEmailTemplateDisplayValue(
      template.emailClosingAr,
      'ar'
    ),
    emailSignoffEn: toEmailTemplateDisplayValue(
      template.emailSignoffEn,
      'en'
    ),
    emailSignoffAr: toEmailTemplateDisplayValue(
      template.emailSignoffAr,
      'ar'
    )
  };
}

export function ReportEmailTemplateEditor({
  template
}: {
  template: ReportTemplateConfig;
}) {
  const t = useTranslations('reportTemplate');
  const [values, setValues] = useState<EditorValues>(
    () => initialValues(template)
  );

  function update(field: EmailFieldName, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value
    }));
  }

  function insertToken(
    field: EmailFieldName,
    token: string
  ) {
    setValues((current) => {
      const existing = current[field];
      const separator =
        existing.length > 0 && !existing.endsWith(' ')
          ? ' '
          : '';

      return {
        ...current,
        [field]: `${existing}${separator}${token}`
      };
    });
  }

  const previewTemplate = useMemo<ReportTemplateConfig>(
    () => ({
      ...template,
      emailSubjectEn: toStoredEmailTemplateValue(
        values.emailSubjectEn,
        'en'
      ),
      emailSubjectAr: toStoredEmailTemplateValue(
        values.emailSubjectAr,
        'ar'
      ),
      emailGreetingEn: toStoredEmailTemplateValue(
        values.emailGreetingEn,
        'en'
      ),
      emailGreetingAr: toStoredEmailTemplateValue(
        values.emailGreetingAr,
        'ar'
      ),
      emailMessageEn: toStoredEmailTemplateValue(
        values.emailMessageEn,
        'en'
      ),
      emailMessageAr: toStoredEmailTemplateValue(
        values.emailMessageAr,
        'ar'
      ),
      emailClosingEn: toStoredEmailTemplateValue(
        values.emailClosingEn,
        'en'
      ),
      emailClosingAr: toStoredEmailTemplateValue(
        values.emailClosingAr,
        'ar'
      ),
      emailSignoffEn: toStoredEmailTemplateValue(
        values.emailSignoffEn,
        'en'
      ),
      emailSignoffAr: toStoredEmailTemplateValue(
        values.emailSignoffAr,
        'ar'
      )
    }),
    [template, values]
  );

  const preview = useMemo(
    () => buildReportEmailTemplatePreview(previewTemplate),
    [previewTemplate]
  );

  const fieldPairs: Array<{
    fields: Array<{name: EmailFieldName; rows?: number}>;
  }> = [
    {
      fields: [
        {name: 'emailSubjectEn'},
        {name: 'emailSubjectAr'}
      ]
    },
    {
      fields: [
        {name: 'emailGreetingEn', rows: 2},
        {name: 'emailGreetingAr', rows: 2}
      ]
    },
    {
      fields: [
        {name: 'emailMessageEn', rows: 4},
        {name: 'emailMessageAr', rows: 4}
      ]
    },
    {
      fields: [
        {name: 'emailClosingEn', rows: 2},
        {name: 'emailClosingAr', rows: 2}
      ]
    },
    {
      fields: [
        {name: 'emailSignoffEn', rows: 2},
        {name: 'emailSignoffAr', rows: 2}
      ]
    }
  ];

  return (
    <div className="email-template-editor">
      <p className="field-help">{t('emailFriendlyTokenHelp')}</p>

      <div className="settings-editor-panel email-template-fields">
        {fieldPairs.map(({fields}, pairIndex) => (
          <div className="email-template-field-pair" key={pairIndex}>
            <div className="form-grid">
              {fields.map(({name, rows}) => {
                const language = languageForField(name);
                const tokens = emailTemplateDisplayTokens(language);
                const dir = language === 'ar' ? 'rtl' : undefined;
                const id = `report-template-${name}-display`;

                return (
                  <FormField
                    htmlFor={id}
                    key={name}
                    label={t(name)}
                  >
                    <input
                      name={name}
                      type="hidden"
                      value={
                        toStoredEmailTemplateValue(
                          values[name],
                          language
                        ) ?? ''
                      }
                    />

                    {rows ? (
                      <textarea
                        dir={dir}
                        id={id}
                        onChange={(event) =>
                          update(name, event.target.value)
                        }
                        rows={rows}
                        value={values[name]}
                      />
                    ) : (
                      <Input
                        dir={dir}
                        id={id}
                        onChange={(event) =>
                          update(name, event.target.value)
                        }
                        value={values[name]}
                      />
                    )}

                    <details className="email-token-picker">
                      <summary>{t('emailInsert')}</summary>

                      <div className="email-token-options">
                        <Button
                          onClick={() =>
                            insertToken(name, tokens.student)
                          }
                          type="button"
                          variant="secondary"
                        >
                          {t('emailTokenStudent')}
                        </Button>

                        <Button
                          onClick={() =>
                            insertToken(name, tokens.school)
                          }
                          type="button"
                          variant="secondary"
                        >
                          {t('emailTokenSchool')}
                        </Button>

                        <Button
                          onClick={() =>
                            insertToken(name, tokens.start)
                          }
                          type="button"
                          variant="secondary"
                        >
                          {t('emailTokenStart')}
                        </Button>

                        <Button
                          onClick={() =>
                            insertToken(name, tokens.end)
                          }
                          type="button"
                          variant="secondary"
                        >
                          {t('emailTokenEnd')}
                        </Button>
                      </div>
                    </details>
                  </FormField>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <section className="email-template-preview-section">
        <div>
          <h3>{t('emailPreviewTitle')}</h3>
          <p className="field-help">
            {t('emailLivePreviewHelp')}
          </p>
        </div>

        <div className="email-template-preview-grid">
          <article className="record-card">
            <div className="record-card-main">
              <h4>{t('emailPreviewEnglish')}</h4>

              <p>
                <strong>{t('emailPreviewSubject')}</strong>{' '}
                {preview.subjectEn || '—'}
              </p>

              {preview.greetingEn ? (
                <p>{preview.greetingEn}</p>
              ) : null}

              {preview.messageEn ? (
                <p style={{whiteSpace: 'pre-line'}}>
                  {preview.messageEn}
                </p>
              ) : null}

              {preview.closingEn ? (
                <p>{preview.closingEn}</p>
              ) : null}

              {preview.signoffEn ? (
                <p>{preview.signoffEn}</p>
              ) : null}
            </div>
          </article>

          <article className="record-card" dir="rtl">
            <div className="record-card-main">
              <h4>{t('emailPreviewArabic')}</h4>

              <p>
                <strong>{t('emailPreviewSubject')}</strong>{' '}
                {preview.subjectAr || '—'}
              </p>

              {preview.greetingAr ? (
                <p>{preview.greetingAr}</p>
              ) : null}

              {preview.messageAr ? (
                <p style={{whiteSpace: 'pre-line'}}>
                  {preview.messageAr}
                </p>
              ) : null}

              {preview.closingAr ? (
                <p>{preview.closingAr}</p>
              ) : null}

              {preview.signoffAr ? (
                <p>{preview.signoffAr}</p>
              ) : null}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
