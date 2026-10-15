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
      (Object.keys(labels.en) as LabelKey[]).map((key) => [
        key,
        `${labels.en[key]} / ${labels.ar[key]}`
      ])
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

function escapeMultiline(value: string) {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>');
}

function cleanText(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function localizedName(
  en: string,
  ar: string | null,
  language: ReportLanguage
) {
  return selectLocalizedText(en, ar, language).map(escapeHtml).join(' / ');
}

function localizedText(
  en: string | null,
  ar: string | null,
  language: ReportLanguage
) {
  return selectLocalizedText(en, ar, language)
    .map(escapeMultiline)
    .join(' / ');
}

function pairedBlocks(
  en: string | null | undefined,
  ar: string | null | undefined,
  multiline = true
) {
  const english = cleanText(en);
  const arabic = cleanText(ar);
  const render = multiline ? escapeMultiline : escapeHtml;

  // Keep bilingual content legible even when mail clients discard <head> CSS.
  const inlineStyle =
    'font-family:Arial,Tahoma,sans-serif;font-size:15px;line-height:1.75;' +
    'margin:0 0 10px 0;overflow-wrap:break-word';
  return [
    english
      ? `<div class="localized-block" lang="en" dir="ltr" style="${inlineStyle};text-align:left">${render(english)}</div>`
      : '',
    arabic
      ? `<div class="localized-block" lang="ar" dir="rtl" style="${inlineStyle};text-align:right">${render(arabic)}</div>`
      : ''
  ].join('');
}

function attendanceMetric(
  attended: number,
  total: number,
  language: ReportLanguage,
  unverified = false
) {
  const notRecorded = total === 0 || unverified;
  const english = notRecorded
    ? 'Attendance: Not recorded'
    : `Attendance: ${attended} of ${total} sessions`;
  const arabic = notRecorded
    ? 'الحضور: غير مسجل'
    : `الحضور: ${attended} من ${total} حصص`;

  if (language === 'both') {
    return pairedBlocks(english, arabic, false);
  }

  return escapeHtml(language === 'ar' ? arabic : english);
}

export function renderStudentReport(
  snapshot: ReportSnapshot,
  language: ReportLanguage = snapshot.language
) {
  const ui = uiLabels(language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const school = localizedName(
    snapshot.school.nameEn,
    snapshot.school.nameAr,
    language
  );
  const student = localizedName(
    snapshot.student.nameEn,
    snapshot.student.nameAr,
    language
  );
  const groups = snapshot.groups
    .map((group) => localizedName(group.nameEn, group.nameAr, language))
    .join(', ');
  const progress = snapshot.progress
    .map(
      (item) =>
        `<li><time>${escapeHtml(item.sessionDate)}</time> — ${localizedText(item.textEn, item.textAr, language)}</li>`
    )
    .join('');
  const comments = snapshot.comments
    .map(
      (item) =>
        `<li><time>${escapeHtml(item.sessionDate)}</time> — ${localizedText(item.textEn, item.textAr, language)}</li>`
    )
    .join('');
  const performance = snapshot.currentPerformance
    ? ui[snapshot.currentPerformance]
    : null;

  return `<!doctype html><html lang="${language === 'both' ? 'en' : language}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(ui.report)}</title><style>body{font-family:Arial,sans-serif;max-width:48rem;margin:auto;padding:1.5rem;color:#172033}section{margin-block:1.5rem}h1,h2{color:#155e75}li{margin-block:.5rem}.summary{display:flex;flex-wrap:wrap;gap:1rem}.summary span{padding:.5rem;background:#f3f4f6;border-radius:.35rem}</style></head><body><header><p>${school}</p><h1>${escapeHtml(ui.report)} — ${student}</h1><p><strong>${escapeHtml(ui.period)}:</strong> <span dir="ltr" style="display:inline-block;white-space:nowrap">${escapeHtml(snapshot.period.start)} – ${escapeHtml(snapshot.period.end)}</span></p><p><strong>${escapeHtml(ui.groups)}:</strong> ${groups}</p></header><section><h2>${escapeHtml(ui.attendance)}</h2><div class="summary"><span>${escapeHtml(ui.present)}: ${snapshot.attendance.present}</span><span>${escapeHtml(ui.absent)}: ${snapshot.attendance.absent}</span><span>${escapeHtml(ui.late)}: ${snapshot.attendance.late}</span><span>${escapeHtml(ui.excused)}: ${snapshot.attendance.excused}</span><span>${escapeHtml(ui.sessions)}: ${snapshot.attendance.sessions}</span></div></section><section><h2>${escapeHtml(ui.progress)}</h2><ul>${progress}</ul></section>${performance ? `<section><h2>${escapeHtml(ui.performance)}</h2><p>${escapeHtml(performance)}</p></section>` : ''}${comments ? `<section><h2>${escapeHtml(ui.comments)}</h2><ul>${comments}</ul></section>` : ''}</body></html>`;
}

export function renderStudentReportV2(
  snapshot: ReportSnapshotV2,
  language: ReportLanguage = snapshot.language,
  {includeSource = true, emailFriendly = false}: {
    includeSource?: boolean;
    emailFriendly?: boolean;
  } = {}
) {
  const ui = uiLabels(language);
  const contentDriven = language === 'both';
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const school = localizedName(
    snapshot.school.nameEn,
    snapshot.school.nameAr,
    language
  );
  const student = localizedName(
    snapshot.student.nameEn,
    snapshot.student.nameAr,
    language
  );
  const className = localizedName(
    snapshot.class.nameEn,
    snapshot.class.nameAr,
    language
  );

  const intro = contentDriven
    ? pairedBlocks(snapshot.template.introEn, snapshot.template.introAr)
    : localizedText(
        snapshot.template.introEn,
        snapshot.template.introAr,
        language
      );
  const closing = contentDriven
    ? pairedBlocks(snapshot.template.closingEn, snapshot.template.closingAr)
    : localizedText(
        snapshot.template.closingEn,
        snapshot.template.closingAr,
        language
      );

  const mainReportLabelEn =
    snapshot.template.mainReportLabelEn === undefined
      ? labels.en.progress
      : snapshot.template.mainReportLabelEn;
  const mainReportLabelAr =
    snapshot.template.mainReportLabelAr === undefined
      ? labels.ar.progress
      : snapshot.template.mainReportLabelAr;
  const performanceLabelEn =
    snapshot.template.performanceLabelEn === undefined
      ? labels.en.performance
      : snapshot.template.performanceLabelEn;
  const performanceLabelAr =
    snapshot.template.performanceLabelAr === undefined
      ? labels.ar.performance
      : snapshot.template.performanceLabelAr;
  const studentCommentLabelEn =
    snapshot.template.studentCommentLabelEn === undefined
      ? labels.en.comments
      : snapshot.template.studentCommentLabelEn;
  const studentCommentLabelAr =
    snapshot.template.studentCommentLabelAr === undefined
      ? labels.ar.comments
      : snapshot.template.studentCommentLabelAr;

  const mainReportLabel = contentDriven
    ? pairedBlocks(mainReportLabelEn, mainReportLabelAr, false)
    : localizedText(mainReportLabelEn, mainReportLabelAr, language);
  const performanceLabel = contentDriven
    ? pairedBlocks(performanceLabelEn, performanceLabelAr, false)
    : localizedText(performanceLabelEn, performanceLabelAr, language);
  const studentCommentLabel = contentDriven
    ? pairedBlocks(studentCommentLabelEn, studentCommentLabelAr, false)
    : localizedText(studentCommentLabelEn, studentCommentLabelAr, language);

  const showPerformance = snapshot.template.performanceEnabled !== false;
  const showStudentComments =
    snapshot.template.studentCommentsEnabled !== false;

  const sections = snapshot.sections
    .map((section, index) => {
      const subject = localizedName(
        section.subjectNameEn,
        section.subjectNameAr,
        language
      );
      const group = section.groupNameEn
        ? localizedName(section.groupNameEn, section.groupNameAr, language)
        : '';
      const progress = contentDriven
        ? pairedBlocks(section.approvedProgressEn, section.approvedProgressAr)
        : localizedText(
            section.approvedProgressEn,
            section.approvedProgressAr,
            language
          );
      const comment = contentDriven
        ? pairedBlocks(section.commentEn, section.commentAr)
        : localizedText(section.commentEn, section.commentAr, language);
      const performance = section.performance
        ? ui[section.performance]
        : null;
      const performanceValue = section.performance
        ? contentDriven
          ? pairedBlocks(
              labels.en[section.performance],
              labels.ar[section.performance],
              false
            )
          : escapeHtml(performance ?? '')
        : '';
      const attendance = attendanceMetric(
        section.attendance.present,
        section.attendance.sessions,
        language,
        section.attendance.unverified
      );

      if (emailFriendly) {
        // Email clients commonly lose borders on semantic <section> elements.
        // A presentation table retains the divider in Outlook, Gmail and mobile.
        const divider = index > 0
          ? '<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:20px 0">' +
            '<tbody><tr><td style="border-top:1px solid #d6e0e5;font-size:0;line-height:0;height:1px">&nbsp;</td></tr></tbody></table>'
          : '';
        const heading = ' style="font-family:Arial,Tahoma,sans-serif;font-size:18px;line-height:1.45;' +
          'font-weight:700;color:#214f61;background-color:#f1f5f8;border-radius:6px;' +
          'padding:12px 14px;margin:0 0 14px;overflow-wrap:break-word"';
        const subheading = (text: string) =>
          `<h3 style="font-family:Arial,Tahoma,sans-serif;font-size:14px;line-height:1.55;font-weight:700;color:#496272;margin:16px 0 7px">${text}</h3>`;
        const copy = (text: string) =>
          `<div class="report-copy" style="font-family:Arial,Tahoma,sans-serif;font-size:15px;line-height:1.7;color:#253645;overflow-wrap:break-word">${text}</div>`;
        const attendanceStyle = 'background-color:#f5f8fa;border-radius:6px;padding:10px 12px;' +
          'font-family:Arial,Tahoma,sans-serif;font-size:14px;line-height:1.6;color:#334155';
        return `${divider}<div class="report-subject-section" style="margin:0 0 24px">
          <h2${heading}>${subject}${group ? ` — ${group}` : ''}</h2>
          <div class="attendance-metric" style="${attendanceStyle}">${attendance}</div>
          ${subheading(mainReportLabel || escapeHtml(ui.progress))}
          ${copy(progress || '—')}
          ${showPerformance && section.performance
            ? subheading(performanceLabel || escapeHtml(ui.performance)) + copy(performanceValue)
            : ''}
          ${showStudentComments && comment
            ? subheading(studentCommentLabel || escapeHtml(ui.comments)) + copy(comment)
            : ''}
        </div>`;
      }

      // The standalone browser report retains its existing semantic sections.
      const divider = index > 0
        ? ' style="border-top:1px dashed #cbd5e1;padding-top:20px;margin-top:24px"'
        : '';
      return `<section${divider}><h2>${subject}${group ? ` — ${group}` : ''}</h2><div class="attendance-metric">${attendance}</div><h3>${mainReportLabel || escapeHtml(ui.progress)}</h3><div class="report-copy">${progress || '—'}</div>${showPerformance && section.performance ? `<h3>${performanceLabel || escapeHtml(ui.performance)}</h3><div class="report-copy">${performanceValue}</div>` : ''}${showStudentComments && comment ? `<h3>${studentCommentLabel || escapeHtml(ui.comments)}</h3><div class="report-copy">${comment}</div>` : ''}</section>`;
    })
    .join('');

  const sourceLine = includeSource
    ? `<p><strong>${escapeHtml(ui.author)}:</strong> ${escapeHtml(snapshot.author)}</p>`
    : '';

  const headerStyle = emailFriendly
    ? ' style="font-family:Arial,Tahoma,sans-serif;font-size:14px;line-height:1.65;' +
      'color:#475569;margin:0 0 22px;padding:0 0 18px;border-bottom:1px solid #edf1f3"'
    : '';
  const headingStyle = emailFriendly
    ? ' style="font-family:Arial,Tahoma,sans-serif;font-size:21px;line-height:1.45;' +
      'font-weight:700;color:#214356;margin:0 0 12px;overflow-wrap:break-word"'
    : '';
  const metaStyle = emailFriendly
    ? ' style="font-family:Arial,Tahoma,sans-serif;font-size:14px;line-height:1.6;' +
      'color:#475569;margin:0 0 8px;overflow-wrap:break-word"'
    : '';
  const footerStyle = emailFriendly
    ? ' style="margin:18px 0 0;padding-top:12px;border-top:1px solid #edf1f3"'
    : '';

  return `<!doctype html><html lang="${language === 'both' ? 'en' : language}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(ui.report)}</title><style>body{font-family:Arial,sans-serif;max-width:48rem;margin:auto;padding:1.5rem;color:#172033}section{margin-block:1.5rem}h1,h2,h3{color:#155e75}.localized-block{margin-block:.35rem}.report-copy .localized-block,.attendance-metric .localized-block{margin-block:.6rem}.attendance-metric{padding:.5rem;background:#f3f4f6;border-radius:.35rem}</style></head><body><header${headerStyle}><p${metaStyle}>${school}</p><h1${headingStyle}>${escapeHtml(ui.report)} — ${student}</h1><p${metaStyle}><strong>${escapeHtml(ui.class)}:</strong> ${className}</p><p${metaStyle}><strong>${escapeHtml(ui.period)}:</strong> <span dir="ltr" style="display:inline-block;white-space:nowrap">${escapeHtml(snapshot.period.start)} – ${escapeHtml(snapshot.period.end)}</span></p>${intro ? `<div class="report-copy">${intro}</div>` : ''}</header>${sections}${closing || sourceLine ? `<footer${footerStyle}>${closing ? `<div class="report-copy">${closing}</div>` : ''}${sourceLine}</footer>` : ''}</body></html>`;
}
