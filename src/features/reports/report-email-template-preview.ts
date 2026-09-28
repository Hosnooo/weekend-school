import type {ReportTemplateConfig} from './report-template.types';

export type EmailTemplateLanguage = 'en' | 'ar';

const storageTokens = {
  student: '{{student_name}}',
  school: '{{school_name}}',
  start: '{{period_start}}',
  end: '{{period_end}}'
} as const;

const displayTokens = {
  en: {
    student: '[Student name]',
    school: '[School name]',
    start: '[Start date]',
    end: '[End date]'
  },
  ar: {
    student: '[اسم الطالب]',
    school: '[اسم المدرسة]',
    start: '[تاريخ البداية]',
    end: '[تاريخ النهاية]'
  }
} as const;

const sampleValues = {
  en: {
    student_name: 'Sara Ali',
    school_name: 'Weekend School',
    period_start: '2026-09-01',
    period_end: '2026-09-30'
  },
  ar: {
    student_name: 'سارة علي',
    school_name: 'مدرسة نهاية الأسبوع',
    period_start: '2026-09-01',
    period_end: '2026-09-30'
  }
} as const;

export function emailTemplateDisplayTokens(
  language: EmailTemplateLanguage
) {
  return displayTokens[language];
}

export function toEmailTemplateDisplayValue(
  value: string | null | undefined,
  language: EmailTemplateLanguage
) {
  if (!value) return '';

  const tokens = displayTokens[language];

  return value
    .replaceAll(storageTokens.student, tokens.student)
    .replaceAll(storageTokens.school, tokens.school)
    .replaceAll(storageTokens.start, tokens.start)
    .replaceAll(storageTokens.end, tokens.end);
}

export function toStoredEmailTemplateValue(
  value: string | null | undefined,
  language: EmailTemplateLanguage
) {
  if (!value) return '';

  const tokens = displayTokens[language];

  return value
    .replaceAll(tokens.student, storageTokens.student)
    .replaceAll(tokens.school, storageTokens.school)
    .replaceAll(tokens.start, storageTokens.start)
    .replaceAll(tokens.end, storageTokens.end);
}

function interpolate(
  value: string | null | undefined,
  language: EmailTemplateLanguage
) {
  if (!value) return '';

  const values = sampleValues[language];

  return value.replace(
    /\{\{(student_name|school_name|period_start|period_end)\}\}/g,
    (_match, key: keyof typeof values) => values[key]
  );
}

export function buildReportEmailTemplatePreview(
  template: ReportTemplateConfig
) {
  return {
    subjectEn: interpolate(template.emailSubjectEn, 'en'),
    subjectAr: interpolate(
      template.emailSubjectAr || template.emailSubjectEn,
      'ar'
    ),
    greetingEn: interpolate(template.emailGreetingEn, 'en'),
    greetingAr: interpolate(template.emailGreetingAr, 'ar'),
    messageEn: interpolate(template.emailMessageEn, 'en'),
    messageAr: interpolate(template.emailMessageAr, 'ar'),
    closingEn: interpolate(template.emailClosingEn, 'en'),
    closingAr: interpolate(template.emailClosingAr, 'ar'),
    signoffEn: interpolate(template.emailSignoffEn, 'en'),
    signoffAr: interpolate(template.emailSignoffAr, 'ar')
  };
}
