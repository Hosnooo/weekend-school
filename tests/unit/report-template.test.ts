import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

import {reportTemplateSchema} from '@/features/reports/report-template.schemas';
import {defaultReportTemplateConfig} from '@/features/reports/report-template.types';

describe('report template configuration', () => {
  it('provides stable school-wide defaults with performance disabled', () => {
    expect(defaultReportTemplateConfig()).toMatchObject({
      id: null,
      name: 'Weekly report',
      mainReportLabelEn: 'Main report',
      performanceEnabled: false,
      performanceLabelEn: 'Performance',
      studentCommentsEnabled: true,
      studentCommentLabelEn: 'Additional student comment',
      introEn: null,
      introAr: null,
      closingEn: null,
      closingAr: null,
      emailSubjectEn:
        'Student report — {{student_name}}',
      emailSubjectAr:
        'تقرير الطالب — {{student_name}}',
      emailGreetingEn: 'Dear Parent/Guardian,',
      emailGreetingAr: 'ولي الأمر الكريم،',
      emailMessageEn:
        "Please find below {{student_name}}'s report for {{period_start}} to {{period_end}}.",
      emailMessageAr:
        'يرجى الاطلاع أدناه على تقرير {{student_name}} للفترة من {{period_start}} إلى {{period_end}}.',
      emailClosingEn: 'Regards,',
      emailClosingAr: 'مع التحية،',
      emailSignoffEn: '{{school_name}}',
      emailSignoffAr: '{{school_name}}'
    });
  });

  it('normalizes optional bilingual wording while requiring core label pairs', () => {
    const parsed = reportTemplateSchema.parse({
      name: '  Weekly report  ',
      mainReportLabelEn: '  Weekly learning  ',
      mainReportLabelAr: '  ',
      mainReportHelpEn: '  What was covered?  ',
      mainReportHelpAr: '',
      performanceEnabled: false,
      performanceLabelEn: '  Progress level  ',
      performanceLabelAr: '',
      studentCommentsEnabled: true,
      studentCommentLabelEn: '  Individual note  ',
      studentCommentLabelAr: '',
      studentCommentHelpEn: '  Only when needed.  ',
      studentCommentHelpAr: '',
      introEn: '',
      introAr: '',
      closingEn: '',
      closingAr: ''
    });

    expect(parsed).toEqual({
      name: 'Weekly report',
      mainReportLabelEn: 'Weekly learning',
      mainReportLabelAr: null,
      mainReportHelpEn: 'What was covered?',
      mainReportHelpAr: null,
      performanceEnabled: false,
      performanceLabelEn: 'Progress level',
      performanceLabelAr: null,
      studentCommentsEnabled: true,
      studentCommentLabelEn: 'Individual note',
      studentCommentLabelAr: null,
      studentCommentHelpEn: 'Only when needed.',
      studentCommentHelpAr: null,
      introEn: null,
      introAr: null,
      closingEn: null,
      closingAr: null,
      emailSubjectEn:
        'Student report — {{student_name}}',
      emailSubjectAr:
        'تقرير الطالب — {{student_name}}',
      emailGreetingEn: 'Dear Parent/Guardian,',
      emailGreetingAr: 'ولي الأمر الكريم،',
      emailMessageEn:
        "Please find below {{student_name}}'s report for {{period_start}} to {{period_end}}.",
      emailMessageAr:
        'يرجى الاطلاع أدناه على تقرير {{student_name}} للفترة من {{period_start}} إلى {{period_end}}.',
      emailClosingEn: 'Regards,',
      emailClosingAr: 'مع التحية،',
      emailSignoffEn: '{{school_name}}',
      emailSignoffAr: '{{school_name}}'
    });
  });

  it('accepts Arabic-only required report labels and email subject', () => {
    const parsed = reportTemplateSchema.parse({
      name: 'Arabic report',
      mainReportLabelEn: '',
      mainReportLabelAr: 'التقرير الرئيسي',
      mainReportHelpEn: '',
      mainReportHelpAr: '',
      performanceEnabled: false,
      performanceLabelEn: '',
      performanceLabelAr: '',
      studentCommentsEnabled: false,
      studentCommentLabelEn: '',
      studentCommentLabelAr: '',
      studentCommentHelpEn: '',
      studentCommentHelpAr: '',
      introEn: '',
      introAr: '',
      closingEn: '',
      closingAr: '',
      emailSubjectEn: '',
      emailSubjectAr: 'تقرير الطالب — {{student_name}}',
      emailGreetingEn: '',
      emailGreetingAr: 'ولي الأمر الكريم،',
      emailMessageEn: '',
      emailMessageAr: '',
      emailClosingEn: '',
      emailClosingAr: '',
      emailSignoffEn: '',
      emailSignoffAr: '{{school_name}}'
    });

    expect(parsed.mainReportLabelEn).toBeNull();
    expect(parsed.mainReportLabelAr).toBe('التقرير الرئيسي');
    expect(parsed.emailSubjectEn).toBeNull();
    expect(parsed.emailSubjectAr).toBe('تقرير الطالب — {{student_name}}');
  });

  it('reads and saves only the active same-school template', () => {
    const source = readFileSync(
      'src/features/reports/report-template.repository.ts',
      'utf8'
    );

    expect(source).toContain('getActiveReportTemplate');
    expect(source).toContain('saveActiveReportTemplate');
    expect(source).toContain("eq('school_id', schoolId)");
    expect(source).toContain("eq('is_active', true)");
    expect(source).toContain('defaultReportTemplateConfig');
    expect(source).toContain('createServerSupabaseClient');
  });
});
