import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {sendReadyReportsAction, sendReportAction} from '@/features/email/email.actions';
import {listEnrollmentClasses} from '@/features/enrollment/enrollment.repository';
import {
  approveAllReportSourcesAction,
  finalizeReportBatchAction,
  prepareReportBatchAction,
  reviewReportBatchAction
} from '@/features/reports/report.actions';
import {
  ReportBatchSummary,
  ReportComposer,
  type ReportComposerLabels
} from '@/features/reports/report-composer';
import {getReportBatchWorkspace} from '@/features/reports/report-batch.repository';
import {getReportingTimezone, listReports} from '@/features/reports/report.repository';
import {monthPeriod} from '@/features/reports/report.service';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';

const batchLabels = {
  en: {
    class: 'Class', scope: 'Report scope', subject: 'Subject', group: 'Group',
    classScope: 'Whole Class', subjectScope: 'Subject', groupScope: 'Group',
    prepare: 'Prepare report batch', reviewTitle: 'Batch review', useAll: 'Use all submitted sources',
    moveReview: 'Move to review', finalize: 'Finalize reports', draft: 'Draft', review: 'Review', finalized: 'Finalized',
    noSources: 'No submitted teaching sources match this period and scope.'
  },
  ar: {
    class: 'الفصل', scope: 'نطاق التقرير', subject: 'المادة', group: 'المجموعة',
    classScope: 'الفصل كاملًا', subjectScope: 'المادة', groupScope: 'المجموعة',
    prepare: 'إعداد دفعة تقارير', reviewTitle: 'مراجعة الدفعة', useAll: 'استخدام كل المصادر المرسلة',
    moveReview: 'الانتقال إلى المراجعة', finalize: 'اعتماد التقارير نهائيًا', draft: 'مسودة', review: 'مراجعة', finalized: 'معتمد نهائيًا',
    noSources: 'لا توجد مصادر تدريس مرسلة تطابق الفترة والنطاق.'
  }
} as const;

const composerLabels: Record<'en' | 'ar', ReportComposerLabels> = {
  en: {
    sources: 'Teacher source blocks',
    useTeacher: (name) => `Use ${name}`,
    customProgressEn: 'Custom official progress (English)',
    customProgressAr: 'Custom official progress (Arabic)',
    readiness: 'Report batch readiness',
    readyAutomatically: 'ready automatically',
    personalizedComments: 'personalized comments',
    attendanceConflicts: 'attendance conflicts',
    missingData: 'missing data'
  },
  ar: {
    sources: 'مصادر المعلمين',
    useTeacher: (name) => `استخدام ${name}`,
    customProgressEn: 'التقدم الرسمي المخصص (بالإنجليزية)',
    customProgressAr: 'التقدم الرسمي المخصص (بالعربية)',
    readiness: 'جاهزية دفعة التقارير',
    readyAutomatically: 'جاهز تلقائيًا',
    personalizedComments: 'تعليقات مخصصة',
    attendanceConflicts: 'تعارضات الحضور',
    missingData: 'بيانات ناقصة'
  }
};

export default async function ReportsPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    periodStart?: string;
    periodEnd?: string;
    batchId?: string;
    error?: string;
    generated?: string;
    sent?: string;
    failed?: string;
    skipped?: string;
  }>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireProfile(locale, 'ADMIN');
  const query = await searchParams;
  const timezone = await getReportingTimezone(profile.schoolId);
  const defaults = monthPeriod(todayInTimeZone(timezone));
  const periodStart = /^\d{4}-\d{2}-\d{2}$/.test(query.periodStart ?? '') ? query.periodStart! : defaults.periodStart;
  const periodEnd = /^\d{4}-\d{2}-\d{2}$/.test(query.periodEnd ?? '') ? query.periodEnd! : defaults.periodEnd;
  const [classes, reports, workspace, t, languages, common] = await Promise.all([
    listEnrollmentClasses(profile.schoolId),
    listReports(profile.schoolId, periodStart, periodEnd),
    query.batchId ? getReportBatchWorkspace(profile.schoolId, query.batchId) : Promise.resolve(null),
    getTranslations({locale, namespace: 'reports'}),
    getTranslations({locale, namespace: 'reportLanguages'}),
    getTranslations({locale, namespace: 'common'})
  ]);
  const labels = batchLabels[locale];
  const sourceLabels = composerLabels[locale];
  const activeClasses = classes.filter(({isActive}) => isActive);
  const subjects = activeClasses.flatMap((schoolClass) => schoolClass.subjects
    .filter(({isActive}) => isActive)
    .map((subject) => ({...subject, classId: schoolClass.id})));
  const groups = subjects.flatMap((subject) => subject.groups
    .filter(({isActive}) => isActive)
    .map((group) => ({...group, classSubjectId: subject.id})));
  const localize = (value: {nameEn: string; nameAr: string | null}) =>
    locale === 'ar' && value.nameAr ? value.nameAr : value.nameEn;
  const defaultClassId = workspace?.batch.classId ?? activeClasses[0]?.id ?? '';
  const defaultSubjectId = workspace?.batch.classSubjectId ?? subjects.find(({classId}) => classId === defaultClassId)?.id ?? '';
  const defaultGroupId = workspace?.batch.subjectGroupId ?? groups.find(({classSubjectId}) => classSubjectId === defaultSubjectId)?.id ?? '';
  const currentScope = workspace?.batch.scopeType ?? 'CLASS';
  const hiddenPeriod = <><input name="locale" type="hidden" value={locale}/><input name="periodStart" type="hidden" value={periodStart}/><input name="periodEnd" type="hidden" value={periodEnd}/></>;
  const batchHidden = workspace ? <>{hiddenPeriod}<input name="batchId" type="hidden" value={workspace.batch.id}/></> : null;
  const statusLabel = workspace?.batch.status === 'FINALIZED'
    ? labels.finalized
    : workspace?.batch.status === 'REVIEW'
      ? labels.review
      : labels.draft;

  return <AdminPage title={t('title')} description={t('description')}>
    <form action={prepareReportBatchAction} className="record-form">
      <input name="locale" type="hidden" value={locale}/>
      <div className="form-grid">
        <label>{t('periodStart')}<input defaultValue={periodStart} name="periodStart" required type="date"/></label>
        <label>{t('periodEnd')}<input defaultValue={periodEnd} name="periodEnd" required type="date"/></label>
        <label>{labels.class}<select defaultValue={defaultClassId} name="classId" required>{activeClasses.map((item) => <option key={item.id} value={item.id}>{localize(item)}</option>)}</select></label>
        <label>{labels.scope}<select defaultValue={currentScope} name="scopeType"><option value="CLASS">{labels.classScope}</option><option value="SUBJECT">{labels.subjectScope}</option><option value="GROUP">{labels.groupScope}</option></select></label>
        <label>{labels.subject}<select defaultValue={defaultSubjectId} name="classSubjectId"><option value="">—</option>{subjects.map((item) => <option key={item.id} value={item.id}>{localize(item)}</option>)}</select></label>
        <label>{labels.group}<select defaultValue={defaultGroupId} name="subjectGroupId"><option value="">—</option>{groups.map((item) => <option key={item.id} value={item.id}>{localize(item)}</option>)}</select></label>
      </div>
      <button className="button button-primary" type="submit">{labels.prepare}</button>
    </form>

    {query.error ? <p className="form-error" role="alert">{t(query.error === 'validation' ? 'validation' : query.error === 'send' ? 'sendError' : 'save')}</p> : null}
    {query.sent !== undefined ? <p aria-live="polite" className="success-message" role="status">{t('sendResult', {sent: Number(query.sent) || 0, failed: Number(query.failed) || 0, skipped: Number(query.skipped) || 0})}</p> : null}

    {workspace ? <section className="subsection" aria-labelledby="batch-review-heading">
      <div className="dashboard-week-heading">
        <div><h2 id="batch-review-heading">{labels.reviewTitle}</h2><p>{workspace.batch.periodStart} – {workspace.batch.periodEnd}</p></div>
        <span className={`status-badge ${workspace.batch.status === 'FINALIZED' ? 'status-active' : ''}`}>{statusLabel}</span>
      </div>
      <ReportBatchSummary labels={sourceLabels} students={workspace.summaryStudents}/>
      {workspace.sources.length === 0 ? <p className="empty-state">{labels.noSources}</p> : <ReportComposer labels={sourceLabels} sources={workspace.sources}/>} 
      {workspace.batch.status === 'DRAFT' && workspace.sources.length > 0 ? <div className="page-actions">
        <form action={approveAllReportSourcesAction}>{batchHidden}<button className="button button-secondary" type="submit">{labels.useAll}</button></form>
        <form action={reviewReportBatchAction}>{batchHidden}<button className="button button-primary" type="submit">{labels.moveReview}</button></form>
      </div> : null}
      {workspace.batch.status === 'REVIEW' ? <form action={finalizeReportBatchAction}>{batchHidden}<button className="button button-primary" type="submit">{labels.finalize}</button></form> : null}
    </section> : null}

    <div className="page-actions"><form action={sendReadyReportsAction}>{hiddenPeriod}<button className="button button-secondary">{t('sendReady')}</button></form></div>
    {reports.length === 0 ? <p className="empty-state">{t('empty')}</p> : <div className="table-wrap"><table><thead><tr><th>{t('student')}</th><th>{t('language')}</th><th>{t('status')}</th><th>{t('generatedAt')}</th><th>{common('actions')}</th></tr></thead><tbody>{reports.map((report) => {const isPending = report.deliveryStatuses.includes('PENDING'); const displayStatus = isPending ? 'PENDING' : report.status; return <tr key={report.id}><td>{locale === 'ar' && report.studentNameAr ? report.studentNameAr : report.studentNameEn}</td><td>{languages(report.language)}</td><td><span className={`status-badge ${displayStatus === 'FAILED' ? 'status-inactive' : 'status-active'}`}>{t(`reportStatus.${displayStatus}`)}</span></td><td>{new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(report.generatedAt))}</td><td><div className="row-actions"><Link href={`/reports/${report.id}`}>{t('preview')}</Link>{!isPending && (report.status === 'READY' || report.status === 'FAILED') ? <form action={sendReportAction}>{hiddenPeriod}<input name="reportId" type="hidden" value={report.id}/><button className="text-button">{report.status === 'FAILED' ? t('retry') : t('send')}</button></form> : null}</div></td></tr>;})}</tbody></table></div>}
  </AdminPage>;
}
