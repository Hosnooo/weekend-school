import {z} from 'zod';

import {optionalText, requiredText} from '@/lib/validation/fields';

const pairedLabel = optionalText;

export const reportTemplateSchema = z.object({
  name: requiredText,
  mainReportLabelEn: pairedLabel,
  mainReportLabelAr: pairedLabel,
  mainReportHelpEn: optionalText,
  mainReportHelpAr: optionalText,
  performanceEnabled: z.boolean(),
  performanceLabelEn: pairedLabel,
  performanceLabelAr: pairedLabel,
  studentCommentsEnabled: z.boolean(),
  studentCommentLabelEn: pairedLabel,
  studentCommentLabelAr: pairedLabel,
  studentCommentHelpEn: optionalText,
  studentCommentHelpAr: optionalText,
  introEn: optionalText,
  introAr: optionalText,
  closingEn: optionalText,
  closingAr: optionalText,
  emailSubjectEn: optionalText.default(
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
}).superRefine((value, context) => {
  const requirePair = (
    en: string | null,
    ar: string | null,
    path: string
  ) => {
    if (en || ar) return;
    context.addIssue({
      code: 'custom',
      message: 'At least one language is required',
      path: [path]
    });
  };

  requirePair(
    value.mainReportLabelEn,
    value.mainReportLabelAr,
    'mainReportLabelEn'
  );
  requirePair(
    value.emailSubjectEn,
    value.emailSubjectAr,
    'emailSubjectEn'
  );

  if (value.performanceEnabled) {
    requirePair(
      value.performanceLabelEn,
      value.performanceLabelAr,
      'performanceLabelEn'
    );
  }

  if (value.studentCommentsEnabled) {
    requirePair(
      value.studentCommentLabelEn,
      value.studentCommentLabelAr,
      'studentCommentLabelEn'
    );
  }
});

export type ReportTemplateInput = z.infer<typeof reportTemplateSchema>;
