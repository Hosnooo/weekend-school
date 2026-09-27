import {z} from 'zod';

import {optionalText, requiredText} from '@/lib/validation/fields';

export const reportTemplateSchema = z.object({
  name: requiredText,
  mainReportLabelEn: requiredText,
  mainReportLabelAr: optionalText,
  mainReportHelpEn: optionalText,
  mainReportHelpAr: optionalText,
  performanceEnabled: z.boolean(),
  performanceLabelEn: requiredText,
  performanceLabelAr: optionalText,
  studentCommentsEnabled: z.boolean(),
  studentCommentLabelEn: requiredText,
  studentCommentLabelAr: optionalText,
  studentCommentHelpEn: optionalText,
  studentCommentHelpAr: optionalText,
  introEn: optionalText,
  introAr: optionalText,
  closingEn: optionalText,
  closingAr: optionalText
});

export type ReportTemplateInput = z.infer<typeof reportTemplateSchema>;
