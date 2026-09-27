import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

import {reportTemplateSchema} from '@/features/reports/report-template.schemas';
import {defaultReportTemplateConfig} from '@/features/reports/report-template.types';

describe('report template configuration', () => {
  it('provides stable school-wide defaults', () => {
    expect(defaultReportTemplateConfig()).toMatchObject({
      id: null,
      name: 'Weekly report',
      mainReportLabelEn: 'Main report',
      performanceEnabled: true,
      performanceLabelEn: 'Performance',
      studentCommentsEnabled: true,
      studentCommentLabelEn: 'Additional student comment',
      introEn: null,
      introAr: null,
      closingEn: null,
      closingAr: null
    });
  });

  it('normalizes optional bilingual wording while requiring core labels', () => {
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
      closingAr: null
    });
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
