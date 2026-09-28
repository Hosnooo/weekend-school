import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

import {
  buildReportEmailTemplatePreview,
  toEmailTemplateDisplayValue,
  toStoredEmailTemplateValue
} from '@/features/reports/report-email-template-preview';
import {defaultReportTemplateConfig} from '@/features/reports/report-template.types';

describe('report email template editor', () => {
  it('uses readable admin tokens instead of storage placeholder syntax', () => {
    expect(
      toEmailTemplateDisplayValue(
        'Student report — {{student_name}}',
        'en'
      )
    ).toBe('Student report — [Student name]');

    expect(
      toEmailTemplateDisplayValue(
        'تقرير الطالب — {{student_name}}',
        'ar'
      )
    ).toBe('تقرير الطالب — [اسم الطالب]');

    expect(
      toStoredEmailTemplateValue(
        'Report for [Student name] — [School name]',
        'en'
      )
    ).toBe(
      'Report for {{student_name}} — {{school_name}}'
    );

    expect(
      toStoredEmailTemplateValue(
        'تقرير [اسم الطالب] — [اسم المدرسة]',
        'ar'
      )
    ).toBe(
      'تقرير {{student_name}} — {{school_name}}'
    );
  });

  it('uses a simple default subject without forcing the school name', () => {
    const template = defaultReportTemplateConfig();

    expect(template.emailSubjectEn).toBe(
      'Student report — {{student_name}}'
    );
    expect(template.emailSubjectAr).toBe(
      'تقرير الطالب — {{student_name}}'
    );
  });

  it('still renders sample values for the preview', () => {
    const preview = buildReportEmailTemplatePreview(
      defaultReportTemplateConfig()
    );

    expect(preview.subjectEn).toBe(
      'Student report — Sara Ali'
    );
    expect(preview.subjectAr).toBe(
      'تقرير الطالب — سارة علي'
    );
  });

  it('uses a dedicated live editor on the Admin template form', () => {
    const source = readFileSync(
      'src/features/reports/report-template-form.tsx',
      'utf8'
    );

    expect(source).toContain('ReportEmailTemplateEditor');
    expect(source).not.toContain(
      "t('emailPlaceholdersHelp')"
    );
    expect(source).not.toContain(
      'buildReportEmailTemplatePreview(template)'
    );
  });
});
