import {getTranslations} from 'next-intl/server';

import {ConfirmSubmitButton} from '@/components/ui/confirm-submit-button';
import {EmptyState} from '@/components/ui/empty-state';
import {sendAdminReportBatchAction} from '@/features/reports/admin-report-delivery.actions';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';

import {
  finalizeClassReportCycleAction,
  reopenAdminReportWorkspaceAction
} from './admin-report-workflow.actions';
import {getClassReportReviewWorkspaceWithAttendance} from './class-report-attendance.repository';
import {getClassReportCycleLivePreview} from './class-report-finalization.repository';
import {getClassReportCycleEmailPreviewAction} from './class-report-preview.actions';
import {
  canReopenClassReportCycle,
  getClassReportPreviewRecipients
} from './class-report-preview.repository';
import {ensureClassReportCycleReview} from './class-report-review.repository';
import type {ClassReportCycleWorkspace} from './report-batch.repository';
import {ReportCycleSourceReview} from './report-cycle-source-review';
import {ReportEmailReview} from './report-email-review';
import {getReport} from './report.repository';
import type {ReportSnapshotV2} from './report.types';
import {
  renderReportEmail,
  renderReportEmailSubject
} from '@/features/email/report-email';

const copy = {
  en: {
    emailReview: 'Email review',
    emailBody: 'Email body',
    selectStudent: 'Student',
    selectStudentPlaceholder: 'Select a student',
    previewUnavailable:
      'Email preview is unavailable until report issues are resolved.',
    parentEmailTo: 'To',
    parentEmailSubject: 'Subject'
  },
  ar: {
    emailReview: 'مراجعة البريد الإلكتروني',
    emailBody: 'محتوى البريد',
    selectStudent: 'الطالب',
    selectStudentPlaceholder: 'اختر طالبًا',
    previewUnavailable:
      'لا تتوفر معاينة البريد حتى يتم حل مشكلات التقرير.',
    parentEmailTo: 'إلى',
    parentEmailSubject: 'الموضوع'
  }
} as const;

export async function ClassReportCycleReview({
  schoolId,
  locale,
  classCycle,
  selectedStudentId,
  openedEditorId
}: {
  schoolId: string;
  locale: Locale;
  classCycle: ClassReportCycleWorkspace;
  selectedStudentId?: string;
  openedEditorId?: string;
}) {
  const t = await getTranslations({locale, namespace: 'reports'});
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

  const review = await getClassReportReviewWorkspaceWithAttendance(
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
    ) ?? null;

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
      console.error('Unable to build Class Report Cycle email preview', {
        error
      });
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
      <input
        name="periodStart"
        type="hidden"
        value={classCycle.batch.periodStart}
      />
      <input
        name="periodEnd"
        type="hidden"
        value={classCycle.batch.periodEnd}
      />
    </>
  );

  const initialPreview = snapshot && selectedStudent
    ? {
        studentId: selectedStudent.studentId,
        recipients: recipients.map(({email}) => email),
        subject: renderReportEmailSubject(snapshot),
        html: renderReportEmail(snapshot)
      }
    : null;

  return (
    <>
      <ReportCycleSourceReview
        canEditFinalized={canReopen}
        openedEditorId={openedEditorId}
        classCycle={classCycle}
        locale={locale}
        review={review}
      />

      {studentOptions.length === 0 ? (
        <section className="detail-section stack report-email-review-panel">
          <div className="section-heading">
            <div>
              <h2>{ui.emailReview}</h2>
            </div>
          </div>
          <EmptyState title={t('noGeneratedReports')} />
        </section>
      ) : (
        <ReportEmailReview
          batchId={classCycle.batch.id}
          initialFailed={previewError}
          initialPreview={initialPreview}
          initialStudentId={selectedStudent?.studentId ?? ''}
          labels={{
            emailReview: ui.emailReview,
            emailBody: ui.emailBody,
            selectStudent: ui.selectStudent,
            selectStudentPlaceholder: ui.selectStudentPlaceholder,
            previewUnavailable: ui.previewUnavailable,
            parentEmailTo: ui.parentEmailTo,
            parentEmailSubject: ui.parentEmailSubject
          }}
          loadPreviewAction={getClassReportCycleEmailPreviewAction}
          locale={locale}
          students={studentOptions.map((student) => ({
            studentId: student.studentId,
            studentName: localize(
              student.studentNameEn,
              student.studentNameAr
            )
          }))}
        />
      )}

      <section className="detail-section stack report-cycle-send">
        <h2>{t('sendStage')}</h2>

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

            {canReopen ? (
              <form action={reopenAdminReportWorkspaceAction}>
                {sharedHidden}
                <ConfirmSubmitButton
                  className="button button-secondary"
                  confirmMessage={t('reopenCycleConfirm')}
                  type="submit"
                >
                  {t('reopenCycleForAdmin')}
                </ConfirmSubmitButton>
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
    </>
  );
}
