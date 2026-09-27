export type ReportTemplateConfig = {
  id: string | null;
  name: string;
  mainReportLabelEn: string;
  mainReportLabelAr: string | null;
  mainReportHelpEn: string | null;
  mainReportHelpAr: string | null;
  performanceEnabled: boolean;
  performanceLabelEn: string;
  performanceLabelAr: string | null;
  studentCommentsEnabled: boolean;
  studentCommentLabelEn: string;
  studentCommentLabelAr: string | null;
  studentCommentHelpEn: string | null;
  studentCommentHelpAr: string | null;
  introEn: string | null;
  introAr: string | null;
  closingEn: string | null;
  closingAr: string | null;
};

export function defaultReportTemplateConfig(): ReportTemplateConfig {
  return {
    id: null,
    name: 'Weekly report',
    mainReportLabelEn: 'Main report',
    mainReportLabelAr: 'التقرير الرئيسي',
    mainReportHelpEn: "Describe what was covered and the group's progress.",
    mainReportHelpAr: 'اذكر ما تمت تغطيته وتقدم الصف أو المجموعة.',
    performanceEnabled: true,
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
    closingAr: null
  };
}
