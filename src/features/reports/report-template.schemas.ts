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
  closingAr: optionalText,
  emailSubjectEn: requiredText.default(
    'Student report — {{student_name}}'
  ),
  emailSubjectAr: optionalText.default(
    'تقرير الطالب — {{student_name}}'
  ),
  emailGreetingEn: optionalText.default(
    'Dear Parent/Guardian,'
  ),
  emailGreetingAr: optionalText.default(
    'ولي الأمر الكريم،'
  ),
  emailMessageEn: optionalText.default(
    "Please find below {{student_name}}'s report for {{period_start}} to {{period_end}}."
  ),
  emailMessageAr: optionalText.default(
    'يرجى الاطلاع أدناه على تقرير {{student_name}} للفترة من {{period_start}} إلى {{period_end}}.'
  ),
  emailClosingEn: optionalText.default('Regards,'),
  emailClosingAr: optionalText.default('مع التحية،'),
  emailSignoffEn: optionalText.default('{{school_name}}'),
  emailSignoffAr: optionalText.default('{{school_name}}')
});

export type ReportTemplateInput = z.infer<typeof reportTemplateSchema>;
