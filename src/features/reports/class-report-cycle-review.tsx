import {getTranslations} from 'next-intl/server';

import {Alert} from '@/components/ui/alert';
import {EmptyState} from '@/components/ui/empty-state';
import {sendAdminReportBatchAction} from '@/features/reports/admin-report-delivery.actions';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';

import {
  finalizeClassReportCycleAction,
  rebuildClassReportReviewContextAction,
  reopenAdminReportWorkspaceAction,
  saveClassReportReviewContextAction
} from './admin-report-workflow.actions';
import {getClassReportCycleLivePreview} from './class-report-finalization.repository';
import {
  canReopenClassReportCycle,
  getClassReportPreviewRecipients
} from './class-report-preview.repository';
import {
  ensureClassReportCycleReview,
  getClassReportReviewWorkspace
} from './class-report-review.repository';
import type {ClassReportCycleWorkspace} from './report-batch.repository';
import {ReportPreviewFrame} from './report-preview-frame';
import {getReport} from './report.repository';
import {renderStudentReportV2} from './report.renderer';
import type {ReportPerformance, ReportSnapshotV2} from './report.types';
import {
  renderReportEmail,
  renderReportEmailSubject
} from '@/features/email/report-email';

const performanceValues: ReportPerformance[] = [
  'EXCELLENT',
  'GOOD',
  'DEVELOPING',
  'NEEDS_SUPPORT'
];

const copy = {
  en: {
    openReport: 'Open report',
    customizeReportText: 'Customize report text',
    customizeReportTextHelp:
      'Leave blank to use the shared report text for this student.',
    rebuildFromSources: 'Rebuild from selected updates',
    previewStudentHelp:
      'Choose a student to review the report and the exact parent email.',
    previewUnavailable:
      'Preview is unavailable until report conflicts are resolved.',
    parentEmailPreview: 'Parent email preview',
    parentEmailTo: 'To',
    parentEmailSubject: 'Subject'
  },
  ar: {
    openReport: 'فتح التقرير',
    customizeReportText: 'تخصيص نص التقرير',
    customizeReportTextHelp:
      'اتركه فارغاً لاستخدام نص التقرير المشترك لهذا الطالب.',
    rebuildFromSources: 'إعادة البناء من التحديثات المحددة',
    previewStudentHelp:
      'اختر طالباً لمراجعة التقرير والبريد الإلكتروني الفعلي لولي الأمر.',
    previewUnavailable:
      'لا تتوفر المعاينة حتى يتم حل تعارضات التقرير.',
    parentEmailPreview: 'معاينة بريد ولي الأمر',
    parentEmailTo: 'إلى',
    parentEmailSubject: 'الموضوع'
  }
} as const;

export async function ClassReportCycleReview({
  schoolId,
  locale,
  classCycle,
  selectedStudentId
}: {
  schoolId: string;
  locale: Locale;
  classCycle: ClassReportCycleWorkspace;
  selectedStudentId?: string;
}) {
  const [t, weekly] = await Promise.all([
    getTranslations({locale, namespace: 'reports'}),
    getTranslations({locale, namespace: 'weekly'})
  ]);
  const ui = copy[locale];

  if (
    classCycle.batch.status !== 'FINALIZED' &&
    classCycle.sources.some(({included}) => included)
  ) {
    await ensureClassReportCycleReview(
      schoolId,
      classCycle.batch.id
    );
  }

  const review = await getClassReportReviewWorkspace(
    schoolId,
    classCycle.batch.id
  );

  if (!review) return null;

  const studentOptions = classCycle.batch.status === 'FINALIZED'
    ? classCycle.reports.map((report) => ({
        studentId: report.studentId,
        studentNameEn: report.studentNameEn,
        studentNameAr: report.studentNameAr
      }))
    : [...new Map(
        review.contexts
          .flatMap(({students}) => students)
          .map((student) => [student.studentId, student])
      ).values()];

  const selectedStudent =
    studentOptions.find(({studentId}) =>
      studentId === selectedStudentId
    ) ?? studentOptions[0] ?? null;

  let snapshot: ReportSnapshotV2 | null = null;
  let previewError = false;

  if (selectedStudent) {
    try {
      if (classCycle.batch.status === 'FINALIZED') {
        const reportRow = classCycle.reports.find(
          ({studentId}) => studentId === selectedStudent.studentId
        );
        const report = reportRow
          ? await getReport(schoolId, reportRow.id)
          : null;

        snapshot =
          report?.snapshot.version === 2
            ? report.snapshot
            : null;
      } else {
        const live = await getClassReportCycleLivePreview(
          schoolId,
          classCycle.batch.id,
          selectedStudent.studentId
        );
        snapshot = live?.snapshot ?? null;
      }
    } catch (error) {
      console.error('Unable to build Class Report Cycle preview', {error});
      previewError = true;
    }
  }

  const recipients = selectedStudent
    ? await getClassReportPreviewRecipients(
        schoolId,
        selectedStudent.studentId
      )
    : [];
  const canReopen = classCycle.batch.status === 'FINALIZED'
    ? await canReopenClassReportCycle(
        schoolId,
        classCycle.batch.id
      )
    : false;

  const localize = (
    en: string | null | undefined,
    ar: string | null | undefined,
    fallback = '—'
  ) => {
    if (locale === 'ar' && ar?.trim()) return ar;
    if (en?.trim()) return en;
    if (ar?.trim()) return ar;
    return fallback;
  };

  const sharedHidden = (
    <>
      <input name="locale" type="hidden" value={locale} />
      <input name="batchId" type="hidden" value={classCycle.batch.id} />
      <input name="periodStart" type="hidden" value={classCycle.batch.periodStart} />
      <input name="periodEnd" type="hidden" value={classCycle.batch.periodEnd} />
    </>
  );

  return (
    <section className="detail-section report-cycle-student-reports">
      <div className="section-heading">
        <div>
          <h2>{t('studentReportsStage')}</h2>
          <p>{t('studentReportsHelp')}</p>
        </div>
      </div>

      {review.contexts.length === 0 ? (
        <EmptyState title={t('noCycleSources')} />
      ) : (
        <div className="stack-list">
          {review.contexts.map((context) => {
            const title = [
              localize(context.subjectNameEn, context.subjectNameAr),
              context.groupNameEn || context.groupNameAr
                ? localize(context.groupNameEn, context.groupNameAr)
                : null
            ].filter(Boolean).join(' · ');

            return (
              <details
                className="record-card"
                key={`${context.classSubjectId}:${context.subjectGroupId ?? 'whole'}`}
              >
                <summary>
                  <strong>{title}</strong>
                  {' · '}
                  {ui.openReport}
                </summary>

                {classCycle.batch.status !== 'FINALIZED' ? (
                  <div className="record-card-main stack">
                    <form
                      action={saveClassReportReviewContextAction}
                      className="record-form"
                    >
                      {sharedHidden}
                      <input
                        name="classSubjectId"
                        type="hidden"
                        value={context.classSubjectId}
                      />
                      <input
                        name="subjectGroupId"
                        type="hidden"
                        value={context.subjectGroupId ?? ''}
                      />

                      <section>
                        <h3>{t('reportWorkspace')}</h3>
                        <div className="form-grid">
                          <label>
                            {t('englishField')}
                            <textarea
                              defaultValue={context.mainReportEn ?? ''}
                              dir="ltr"
                              name="mainReportEn"
                              rows={6}
                            />
                          </label>
                          <label>
                            {t('arabicField')}
                            <textarea
                              defaultValue={context.mainReportAr ?? ''}
                              dir="rtl"
                              name="mainReportAr"
                              rows={6}
                            />
                          </label>
                        </div>
                      </section>

                      {review.template.performanceEnabled ? (
                        <input
                          name="includePerformance"
                          type="hidden"
                          value="1"
                        />
                      ) : null}
                      {review.template.studentCommentsEnabled ? (
                        <input
                          name="includeStudentComments"
                          type="hidden"
                          value="1"
                        />
                      ) : null}

                      <section>
                        <h3>{weekly('students')}</h3>
                        <div className="stack-list">
                          {context.students.map((student) => (
                            <article
                              className="record-card"
                              key={student.studentId}
                            >
                              <div className="record-card-main">
                                <strong className="record-name">
                                  {localize(
                                    student.studentNameEn,
                                    student.studentNameAr
                                  )}
                                </strong>
                                <input
                                  name="studentId"
                                  type="hidden"
                                  value={student.studentId}
                                />

                                {review.template.performanceEnabled ? (
                                  <label>
                                    {t('performance')}
                                    <select
                                      defaultValue={
                                        student.performanceOverridden
                                          ? student.performance ?? ''
                                          : ''
                                      }
                                      name={`performance:${student.studentId}`}
                                    >
                                      <option value="">
                                        {weekly('useDefault')}
                                      </option>
                                      {performanceValues.map((value) => (
                                        <option key={value} value={value}>
                                          {weekly(`performance.${value}`)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ) : null}

                                {review.template.studentCommentsEnabled ? (
                                  <div className="form-grid">
                                    <label>
                                      {t('englishField')}
                                      <textarea
                                        defaultValue={student.commentEn ?? ''}
                                        dir="ltr"
                                        name={`commentEn:${student.studentId}`}
                                        rows={2}
                                      />
                                    </label>
                                    <label>
                                      {t('arabicField')}
                                      <textarea
                                        defaultValue={student.commentAr ?? ''}
                                        dir="rtl"
                                        name={`commentAr:${student.studentId}`}
                                        rows={2}
                                      />
                                    </label>
                                  </div>
                                ) : null}

                                <details>
                                  <summary>{ui.customizeReportText}</summary>
                                  <p className="field-help">
                                    {ui.customizeReportTextHelp}
                                  </p>
                                  <div className="form-grid">
                                    <label>
                                      {t('englishField')}
                                      <textarea
                                        defaultValue={student.progressEn ?? ''}
                                        dir="ltr"
                                        name={`progressEn:${student.studentId}`}
                                        rows={4}
                                      />
                                    </label>
                                    <label>
                                      {t('arabicField')}
                                      <textarea
                                        defaultValue={student.progressAr ?? ''}
                                        dir="rtl"
                                        name={`progressAr:${student.studentId}`}
                                        rows={4}
                                      />
                                    </label>
                                  </div>
                                </details>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>

                      <button
                        className="button button-secondary"
                        type="submit"
                      >
                        {t('saveChanges')}
                      </button>
                    </form>

                    <form action={rebuildClassReportReviewContextAction}>
                      {sharedHidden}
                      <input
                        name="classSubjectId"
                        type="hidden"
                        value={context.classSubjectId}
                      />
                      <input
                        name="subjectGroupId"
                        type="hidden"
                        value={context.subjectGroupId ?? ''}
                      />
                      <button
                        className="button button-secondary"
                        type="submit"
                      >
                        {ui.rebuildFromSources}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="record-card-main">
                    {context.mainReportEn ? (
                      <p dir="ltr" style={{whiteSpace: 'pre-wrap'}}>
                        {context.mainReportEn}
                      </p>
                    ) : null}
                    {context.mainReportAr ? (
                      <p dir="rtl" style={{whiteSpace: 'pre-wrap'}}>
                        {context.mainReportAr}
                      </p>
                    ) : null}
                  </div>
                )}
              </details>
            );
          })}
        </div>
      )}

      <section className="stack">
        <div>
          <h3>{t('preview')}</h3>
          <p className="field-help">{ui.previewStudentHelp}</p>
        </div>

        {studentOptions.length === 0 ? (
          <EmptyState title={t('noGeneratedReports')} />
        ) : (
          <div className="row-actions">
            {studentOptions.map((student) => (
              <Link
                className={
                  student.studentId === selectedStudent?.studentId
                    ? 'button button-primary action-link'
                    : 'button button-secondary action-link'
                }
                href={`/reports/workspace/${classCycle.batch.id}?student=${student.studentId}`}
                key={student.studentId}
              >
                {localize(student.studentNameEn, student.studentNameAr)}
              </Link>
            ))}
          </div>
        )}

        {previewError ? (
          <Alert variant="warning">{ui.previewUnavailable}</Alert>
        ) : null}

        {snapshot && selectedStudent ? (
          <div className="stack">
            <details>
              <summary>{t('previewReport')}</summary>
              <ReportPreviewFrame
                html={renderStudentReportV2(snapshot, snapshot.language)}
                title={t('previewReport')}
              />
            </details>

            <section>
              <h3>{ui.parentEmailPreview}</h3>
              <p className="record-meta">
                <strong>{ui.parentEmailTo}:</strong>{' '}
                {recipients.length > 0
                  ? recipients.map(({email}) => email).join(', ')
                  : '—'}
              </p>
              <p className="record-meta">
                <strong>{ui.parentEmailSubject}:</strong>{' '}
                {renderReportEmailSubject(snapshot)}
              </p>
              <ReportPreviewFrame
                html={renderReportEmail(snapshot)}
                title={ui.parentEmailPreview}
              />
            </section>
          </div>
        ) : null}
      </section>

      <section className="stack">
        <h3>{t('sendStage')}</h3>

        {classCycle.batch.status !== 'FINALIZED' ? (
          <form action={finalizeClassReportCycleAction}>
            {sharedHidden}
            <button
              className="button button-primary"
              disabled={review.contexts.length === 0}
              type="submit"
            >
              {t('finalizeAndPrepare')}
            </button>
          </form>
        ) : (
          <div className="row-actions">
            {canReopen ? (
              <form action={reopenAdminReportWorkspaceAction}>
                {sharedHidden}
                <button
                  className="button button-secondary"
                  type="submit"
                >
                  {t('editReport')}
                </button>
              </form>
            ) : null}

            {classCycle.reports.length > 0 ? (
              <form action={sendAdminReportBatchAction}>
                {sharedHidden}
                <button
                  className="button button-primary"
                  type="submit"
                >
                  {t('sendContextReports')}
                </button>
              </form>
            ) : null}

            <Link
              className="button button-secondary action-link"
              href="/reports/delivery-status"
            >
              {t('viewDeliveryStatus')}
            </Link>
          </div>
        )}
      </section>
    </section>
  );
}
