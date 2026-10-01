export type ReportTemplateConfig = {
  id: string | null;
  name: string;
  mainReportLabelEn: string | null;
  mainReportLabelAr: string | null;
  mainReportHelpEn: string | null;
  mainReportHelpAr: string | null;
  performanceEnabled: boolean;
  performanceLabelEn: string | null;
  performanceLabelAr: string | null;
  studentCommentsEnabled: boolean;
  studentCommentLabelEn: string | null;
  studentCommentLabelAr: string | null;
  studentCommentHelpEn: string | null;
  studentCommentHelpAr: string | null;
  introEn: string | null;
  introAr: string | null;
  closingEn: string | null;
  closingAr: string | null;
  emailSubjectEn: string | null;
  emailSubjectAr: string | null;
  emailGreetingEn: string | null;
  emailGreetingAr: string | null;
  emailMessageEn: string | null;
  emailMessageAr: string | null;
  emailClosingEn: string | null;
  emailClosingAr: string | null;
  emailSignoffEn: string | null;
  emailSignoffAr: string | null;
};

export function defaultReportTemplateConfig(): ReportTemplateConfig {
  return {
    id: null,
    name: 'Weekly report',
    mainReportLabelEn: 'Main report',
    mainReportLabelAr: 'التقرير الرئيسي',
    mainReportHelpEn: "Describe what was covered and the group's progress.",
    mainReportHelpAr: 'اذكر ما تمت تغطيته وتقدم الصف أو المجموعة.',
    performanceEnabled: false,
    performanceLabelEn: 'Performance',
    performanceLabelAr: 'الأداء',
    studentCommentsEnabled: true,
    studentCommentLabelEn: 'Additional student comment',
    studentCommentLabelAr: 'ملاحظة إضافية للطالب',
    studentCommentHelpEn:
      'Add a comment only when this student needs an individual note.',
    studentCommentHelpAr:
      'أضف ملاحظة فقط عندما يحتاج هذا الطالب إلى ملاحظة فردية.',
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
  };
}
