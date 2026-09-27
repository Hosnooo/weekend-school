import type {ReportLanguage, ReportSnapshot, ReportSnapshotV2} from './report.types';
import {selectLocalizedText} from './report.service';

const labels = {
  en: {
    report: 'Student Report',
    period: 'Reporting period',
    class: 'Class',
    groups: 'Groups',
    attendance: 'Attendance',
    progress: 'Progress',
    performance: 'Performance',
    comments: 'Comments',
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    excused: 'Excused',
    sessions: 'Sessions',
    notRated: 'Not rated',
    author: 'Source',
    EXCELLENT: 'Excellent',
    GOOD: 'Good',
    DEVELOPING: 'Developing',
    NEEDS_SUPPORT: 'Needs support'
  },
  ar: {
    report: 'تقرير الطالب',
    period: 'فترة التقرير',
    class: 'الفصل',
    groups: 'المجموعات',
    attendance: 'الحضور',
    progress: 'التقدم',
    performance: 'الأداء',
    comments: 'التعليقات',
    present: 'حاضر',
    absent: 'غائب',
    late: 'متأخر',
    excused: 'بعذر',
    sessions: 'الحصص',
    notRated: 'غير مقيّم',
    author: 'المصدر',
    EXCELLENT: 'ممتاز',
    GOOD: 'جيد',
    DEVELOPING: 'قيد التطور',
    NEEDS_SUPPORT: 'يحتاج إلى دعم'
  }
} as const;

type LabelKey = keyof typeof labels.en;

function uiLabels(language: ReportLanguage): Record<LabelKey, string> {
  if (language === 'both') {
    return Object.fromEntries(
      (Object.keys(labels.en) as LabelKey[]).map((key) => [key, `${labels.en[key]} / ${labels.ar[key]}`])
    ) as Record<LabelKey, string>;
  }
  return language === 'ar' ? labels.ar : labels.en;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function localizedName(en: string, ar: string | null, language: ReportLanguage) {
  return selectLocalizedText(en, ar, language).map(escapeHtml).join(' / ');
}

function localizedText(en: string | null, ar: string | null, language: ReportLanguage) {
  return selectLocalizedText(en, ar, language).map(escapeHtml).join(' / ');
}

export function renderStudentReport(
  snapshot: ReportSnapshot,
  language: ReportLanguage = snapshot.language
) {
  const ui = uiLabels(language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const school = localizedName(snapshot.school.nameEn, snapshot.school.nameAr, language);
  const student = localizedName(snapshot.student.nameEn, snapshot.student.nameAr, language);
  const groups = snapshot.groups
    .map((group) => localizedName(group.nameEn, group.nameAr, language))
    .join(', ');
  const progress = snapshot.progress
    .map((item) => `<li><time>${escapeHtml(item.sessionDate)}</time> — ${localizedText(item.textEn, item.textAr, language)}</li>`)
    .join('');
  const comments = snapshot.comments
    .map((item) => `<li><time>${escapeHtml(item.sessionDate)}</time> — ${localizedText(item.textEn, item.textAr, language)}</li>`)
    .join('');
  const performance = snapshot.currentPerformance ? ui[snapshot.currentPerformance] : ui.notRated;

  return `<!doctype html><html lang="${language === 'both' ? 'en' : language}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(ui.report)}</title><style>body{font-family:Arial,sans-serif;max-width:48rem;margin:auto;padding:1.5rem;color:#172033}section{margin-block:1.5rem}h1,h2{color:#155e75}li{margin-block:.5rem}.summary{display:flex;flex-wrap:wrap;gap:1rem}.summary span{padding:.5rem;background:#f3f4f6;border-radius:.35rem}</style></head><body><header><p>${school}</p><h1>${escapeHtml(ui.report)} — ${student}</h1><p><strong>${escapeHtml(ui.period)}:</strong> <span dir="ltr" style="display:inline-block;white-space:nowrap">${escapeHtml(snapshot.period.start)} – ${escapeHtml(snapshot.period.end)}</span></p><p><strong>${escapeHtml(ui.groups)}:</strong> ${groups}</p></header><section><h2>${escapeHtml(ui.attendance)}</h2><div class="summary"><span>${escapeHtml(ui.present)}: ${snapshot.attendance.present}</span><span>${escapeHtml(ui.absent)}: ${snapshot.attendance.absent}</span><span>${escapeHtml(ui.late)}: ${snapshot.attendance.late}</span><span>${escapeHtml(ui.excused)}: ${snapshot.attendance.excused}</span><span>${escapeHtml(ui.sessions)}: ${snapshot.attendance.sessions}</span></div></section><section><h2>${escapeHtml(ui.progress)}</h2><ul>${progress}</ul></section><section><h2>${escapeHtml(ui.performance)}</h2><p>${escapeHtml(performance)}</p></section>${comments ? `<section><h2>${escapeHtml(ui.comments)}</h2><ul>${comments}</ul></section>` : ''}</body></html>`;
}

export function renderStudentReportV2(
  snapshot: ReportSnapshotV2,
  language: ReportLanguage = snapshot.language
) {
  const ui = uiLabels(language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const school = localizedName(snapshot.school.nameEn, snapshot.school.nameAr, language);
  const student = localizedName(snapshot.student.nameEn, snapshot.student.nameAr, language);
  const className = localizedName(snapshot.class.nameEn, snapshot.class.nameAr, language);
  const intro = localizedText(snapshot.template.introEn, snapshot.template.introAr, language);
  const closing = localizedText(snapshot.template.closingEn, snapshot.template.closingAr, language);
  const mainReportLabel = localizedText(
    snapshot.template.mainReportLabelEn ?? labels.en.progress,
    snapshot.template.mainReportLabelAr ?? labels.ar.progress,
    language
  );
  const performanceLabel = localizedText(
    snapshot.template.performanceLabelEn ?? labels.en.performance,
    snapshot.template.performanceLabelAr ?? labels.ar.performance,
    language
  );
  const studentCommentLabel = localizedText(
    snapshot.template.studentCommentLabelEn ?? labels.en.comments,
    snapshot.template.studentCommentLabelAr ?? labels.ar.comments,
    language
  );
  const showPerformance = snapshot.template.performanceEnabled !== false;
  const showStudentComments =
    snapshot.template.studentCommentsEnabled !== false;

  const sections = snapshot.sections.map((section) => {
    const subject = localizedName(section.subjectNameEn, section.subjectNameAr, language);
    const group = section.groupNameEn
      ? localizedName(section.groupNameEn, section.groupNameAr, language)
      : '';
    const progress = localizedText(section.approvedProgressEn, section.approvedProgressAr, language);
    const comment = localizedText(section.commentEn, section.commentAr, language);
    const performance = section.performance ? ui[section.performance] : ui.notRated;
    return `<section><h2>${subject}${group ? ` — ${group}` : ''}</h2><div class="summary"><span>${escapeHtml(ui.present)}: ${section.attendance.present}</span><span>${escapeHtml(ui.absent)}: ${section.attendance.absent}</span><span>${escapeHtml(ui.sessions)}: ${section.attendance.sessions}</span></div><h3>${mainReportLabel || escapeHtml(ui.progress)}</h3><p>${progress || '—'}</p>${showPerformance ? `<h3>${performanceLabel || escapeHtml(ui.performance)}</h3><p>${escapeHtml(performance)}</p>` : ''}${showStudentComments && comment ? `<h3>${studentCommentLabel || escapeHtml(ui.comments)}</h3><p>${comment}</p>` : ''}</section>`;
  }).join('');

  return `<!doctype html><html lang="${language === 'both' ? 'en' : language}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(ui.report)}</title><style>body{font-family:Arial,sans-serif;max-width:48rem;margin:auto;padding:1.5rem;color:#172033}section{margin-block:1.5rem}h1,h2,h3{color:#155e75}.summary{display:flex;flex-wrap:wrap;gap:1rem}.summary span{padding:.5rem;background:#f3f4f6;border-radius:.35rem}</style></head><body><header><p>${school}</p><h1>${escapeHtml(ui.report)} — ${student}</h1><p><strong>${escapeHtml(ui.class)}:</strong> ${className}</p><p><strong>${escapeHtml(ui.period)}:</strong> <span dir="ltr" style="display:inline-block;white-space:nowrap">${escapeHtml(snapshot.period.start)} – ${escapeHtml(snapshot.period.end)}</span></p>${intro ? `<p>${intro}</p>` : ''}</header>${sections}${closing ? `<footer><p>${closing}</p><p><strong>${escapeHtml(ui.author)}:</strong> ${escapeHtml(snapshot.author)}</p></footer>` : `<footer><p><strong>${escapeHtml(ui.author)}:</strong> ${escapeHtml(snapshot.author)}</p></footer>`}</body></html>`;
}
