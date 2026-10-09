import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AttendanceConflictList} from '@/features/attendance/attendance-conflict-list';
import {Alert} from '@/components/ui/alert';
import {
  Badge,
  type BadgeVariant
} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';
import {ConfirmSubmitButton} from '@/components/ui/confirm-submit-button';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import type {AdminReportContextStatus} from '@/features/reports/admin-report-contexts';
import {sendAdminReportBatchAction} from '@/features/reports/admin-report-delivery.actions';
import {
  cancelClassReportCycleAction,
  finalizeAdminReportWorkspaceAction,
  reopenAdminReportWorkspaceAction,
  saveAdminReportWorkspaceAction
} from '@/features/reports/admin-report-workflow.actions';
import {getAdminReportWorkspace} from '@/features/reports/admin-report-workspace.repository';
import {ClassReportCycleReview} from '@/features/reports/class-report-cycle-review';
import {getClassReportCycleWorkspace} from '@/features/reports/report-batch.repository';
import {formatTeachingUpdateRange} from '@/features/teaching-updates/teaching-update-date';
import type {ReportPerformance} from '@/features/reports/report.types';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';
import {databaseUuid} from '@/lib/validation/fields';

const performanceValues: ReportPerformance[] = [
  'EXCELLENT',
  'GOOD',
  'DEVELOPING',
  'NEEDS_SUPPORT'
];

type ReportErrorKey =
  | 'validation'
  | 'sendError'
  | 'errorAlreadySent'
  | 'errorAttendanceConflict'
  | 'errorSourcesMissing'
  | 'errorStale'
  | 'errorPermission'
  | 'errorRule'
  | 'saveError';

function userReportError(t: (key: ReportErrorKey) => string, reason: string) {
  switch (reason) {
    case 'validation': return t('validation');
    case 'send': return t('sendError');
    case 'sent': return t('errorAlreadySent');
    case 'attendance': return t('errorAttendanceConflict');
    case 'sources': return t('errorSourcesMissing');
    case 'stale': return t('errorStale');
    case 'permission': return t('errorPermission');
    case 'rule': return t('errorRule');
    default: return t('saveError');
  }
}

function statusVariant(
  status: AdminReportContextStatus
): BadgeVariant {
  if (status === 'SENT') return 'success';
  if (status === 'DELIVERY_ISSUE') return 'danger';
  if (status === 'READY_TO_SEND') return 'info';
  if (status === 'READY_FOR_REVIEW') return 'warning';
  return 'neutral';
}

export default async function AdminReportWorkspacePage({
  params,
  searchParams
}: {
  params: Promise<{
    locale: string;
    batchId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    finalized?: string;
    sent?: string;
    failed?: string;
    skipped?: string;
    requested?: string;
    student?: string;
    editor?: string;
  }>;
}) {
  const {locale, batchId: rawBatchId} = await params;

  if (!isLocale(locale)) notFound();

  const parsedBatchId = databaseUuid.safeParse(rawBatchId);
  if (!parsedBatchId.success) notFound();

  const profile = await requireProfile(locale, 'ADMIN');
  const query = await searchParams;

  const [
    classCycle,
    workspace,
    t,
    weekly
  ] = await Promise.all([
    getClassReportCycleWorkspace(
      parsedBatchId.data
    ),
    getAdminReportWorkspace(
      profile.schoolId,
      parsedBatchId.data
    ),
    getTranslations({
      locale,
      namespace: 'reports'
    }),
    getTranslations({
      locale,
      namespace: 'weekly'
    })
  ]);

  if (classCycle) {
    const className =
      locale === 'ar' && classCycle.classInfo.nameAr
        ? classCycle.classInfo.nameAr
        : classCycle.classInfo.nameEn;

    return (
      <section className="admin-page report-cycle-workspace-page">
        <PageHeader
          actions={
            <div className="row-actions">
              <Link
                className="button button-secondary action-link"
                href="/reports"
              >
                {t('title')}
              </Link>
              {classCycle.canDismiss ? (
                <form action={cancelClassReportCycleAction}>
                  <input name="locale" type="hidden" value={locale} />
                  <input name="batchId" type="hidden" value={classCycle.batch.id} />
                  <ConfirmSubmitButton
                    className="button button-danger"
                    confirmMessage={t('dismissCycleConfirm')}
                    type="submit"
                  >
                    {t('dismissCycle')}
                  </ConfirmSubmitButton>
                </form>
              ) : null}
            </div>
          }
          description={formatTeachingUpdateRange(classCycle.batch.periodStart, classCycle.batch.periodEnd, locale)}
          title={`${t('reportCycle')} · ${className}`}
        />

        <div className="page-actions">
          <Badge
            variant={
              classCycle.batch.status === 'FINALIZED'
                ? 'success'
                : classCycle.batch.status === 'REVIEW'
                  ? 'info'
                  : 'warning'
            }
          >
            {t(
              `cycleStatus.${classCycle.batch.status}`
            )}
          </Badge>
        </div>

        {query.error ? (
          <Alert variant="danger">
            {userReportError(t, query.error)}
          </Alert>
        ) : null}

        {query.saved ? (
          <Alert variant="success">
            {t('savedMessage')}
          </Alert>
        ) : null}

        {query.requested ? (
          <Alert variant={Number(query.failed) > 0 ? 'warning' : 'success'}>
            {t('missingUpdateRequested')}
          </Alert>
        ) : null}

        {query.finalized ? (
          <Alert variant="success">
            {t('finalizedMessage')}
          </Alert>
        ) : null}

        {query.sent !== undefined ? (
          <Alert variant="success">
            {t('sendResult', {
              sent: Number(query.sent) || 0,
              failed: Number(query.failed) || 0,
              skipped: Number(query.skipped) || 0
            })}
          </Alert>
        ) : null}

        <ClassReportCycleReview
          classCycle={classCycle}
          locale={locale}
          schoolId={profile.schoolId}
          selectedStudentId={query.student}
          openedEditorId={query.editor}
        />
      </section>
    );
  }

  if (!workspace) notFound();

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

  const contextTitle = [
    localize(
      workspace.context.classNameEn,
      workspace.context.classNameAr
    ),
    localize(
      workspace.context.subjectNameEn,
      workspace.context.subjectNameAr
    ),
    workspace.context.groupNameEn
      ? localize(
          workspace.context.groupNameEn,
          workspace.context.groupNameAr
        )
      : null
  ]
    .filter(Boolean)
    .join(' · ');

  const backParams = new URLSearchParams({
    periodStart: workspace.periodStart,
    periodEnd: workspace.periodEnd
  });

  const backHref = `/reports?${backParams.toString()}`;

  const hiddenPeriod = (
    <>
      <input name="locale" type="hidden" value={locale} />
      <input
        name="periodStart"
        type="hidden"
        value={workspace.periodStart}
      />
      <input
        name="periodEnd"
        type="hidden"
        value={workspace.periodEnd}
      />
    </>
  );

  const totalPresent = workspace.attendanceSummary.reduce(
    (sum, student) => sum + student.presentCount,
    0
  );

  const totalAbsent = workspace.attendanceSummary.reduce(
    (sum, student) => sum + student.absentCount,
    0
  );

  const mainReportLabel = localize(
    workspace.template.mainReportLabelEn,
    workspace.template.mainReportLabelAr,
    t('reportWorkspace')
  );

  const mainReportHelp = localize(
    workspace.template.mainReportHelpEn,
    workspace.template.mainReportHelpAr,
    ''
  );

  const performanceLabel = localize(
    workspace.template.performanceLabelEn,
    workspace.template.performanceLabelAr,
    t('performance')
  );

  const studentCommentLabel = localize(
    workspace.template.studentCommentLabelEn,
    workspace.template.studentCommentLabelAr,
    t('studentCommentsTitle')
  );

  const teachers =
    workspace.context.teacherNames.length > 0
      ? workspace.context.teacherNames.join(', ')
      : t('noTeacher');

  return (
    <section className="admin-page">
      <PageHeader
        actions={
          <Link
            className="button button-secondary action-link"
            href={backHref}
          >
            {t('title')}
          </Link>
        }
        description={`${workspace.periodStart} – ${workspace.periodEnd} · ${teachers}`}
        title={contextTitle}
      />

      <div className="dashboard-week-heading">
        <div>
          <p className="report-batch-meta">
            {t('submissionCount', {
              count: workspace.context.submissionCount
            })}
          </p>
        </div>

        <Badge
          variant={statusVariant(
            workspace.context.status
          )}
        >
          {t(
            `contextStatus.${workspace.context.status}`
          )}
        </Badge>
      </div>

      {query.error ? (
        <Alert variant="danger">
          {query.error === 'validation'
            ? t('validation')
            : query.error === 'send'
              ? t('sendError')
              : t('saveError')}
        </Alert>
      ) : null}

      {query.saved ? (
        <Alert variant="success">
          {t('savedMessage')}
        </Alert>
      ) : null}

      {query.finalized ? (
        <Alert variant="success">
          {t('finalizedMessage')}
        </Alert>
      ) : null}

      {query.sent !== undefined ? (
        <Alert variant="success">
          {t('sendResult', {
            sent: Number(query.sent) || 0,
            failed: Number(query.failed) || 0,
            skipped: Number(query.skipped) || 0
          })}
        </Alert>
      ) : null}

      <Card className="content-section report-workspace">
        {workspace.context.status === 'WAITING' ? (
          <Alert variant="warning">
            {t('waitingForTeacher')}
          </Alert>
        ) : (
          <>
            {workspace.canEdit ? (
              <form
                action={saveAdminReportWorkspaceAction}
                className="record-form"
              >
                {hiddenPeriod}

                <input
                  name="batchId"
                  type="hidden"
                  value={workspace.batchId}
                />

                <section>
                  <h2>{mainReportLabel}</h2>
                  {mainReportHelp ? (
                    <p>{mainReportHelp}</p>
                  ) : null}

                  <div className="form-grid">
                    <label>
                      {t('englishField')}
                      <textarea
                        defaultValue={
                          workspace.mainReportEn ?? ''
                        }
                        dir="ltr"
                        name="mainReportEn"
                        rows={7}
                      />
                    </label>

                    <label>
                      {t('arabicField')}
                      <textarea
                        defaultValue={
                          workspace.mainReportAr ?? ''
                        }
                        dir="rtl"
                        name="mainReportAr"
                        rows={7}
                      />
                    </label>
                  </div>
                </section>

                {workspace.template.performanceEnabled ? (
                  <section>
                    <h2>{performanceLabel}</h2>
                    <input
                      name="includePerformance"
                      type="hidden"
                      value="1"
                    />

                    <div className="stack-list">
                      {workspace.attendanceSummary.map((student) => (
                        <label
                          className="record-card"
                          key={student.studentId}
                        >
                          <strong>
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

                          <select
                            defaultValue={student.performance ?? ''}
                            name={`performance:${student.studentId}`}
                          >
                            <option value="">—</option>

                            {performanceValues.map((value) => (
                              <option key={value} value={value}>
                                {weekly(`performance.${value}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section>
                  <h2>{t('attendanceSummary')}</h2>
                  <p>
                    {t('attendanceCounts', {
                      present: totalPresent,
                      absent: totalAbsent
                    })}
                  </p>
                </section>

                {workspace.template.studentCommentsEnabled ? (
                  <section>
                    <input
                      name="includeStudentComments"
                      type="hidden"
                      value="1"
                    />
                    <h2>{studentCommentLabel}</h2>

                    {workspace.studentComments.length === 0 ? (
                      <EmptyState
                        title={t('noStudentComments')}
                      />
                    ) : (
                      <div className="stack-list">
                        {workspace.studentComments.map(
                          (student) => (
                            <article
                              className="record-card"
                              key={student.studentId}
                            >
                              <div className="record-card-main">
                                <h3>
                                  {localize(
                                    student.studentNameEn,
                                    student.studentNameAr
                                  )}
                                </h3>

                                <input
                                  name="studentId"
                                  type="hidden"
                                  value={student.studentId}
                                />

                                <div className="form-grid">
                                  <label>
                                    {t('englishField')}
                                    <textarea
                                      defaultValue={
                                        student.commentEn ?? ''
                                      }
                                      dir="ltr"
                                      name={`commentEn:${student.studentId}`}
                                      rows={3}
                                    />
                                  </label>

                                  <label>
                                    {t('arabicField')}
                                    <textarea
                                      defaultValue={
                                        student.commentAr ?? ''
                                      }
                                      dir="rtl"
                                      name={`commentAr:${student.studentId}`}
                                      rows={3}
                                    />
                                  </label>
                                </div>
                              </div>
                            </article>
                          )
                        )}
                      </div>
                    )}
                  </section>
                ) : null}

                <div className="page-actions">
                  <button
                    className="button button-secondary"
                    type="submit"
                  >
                    {t('saveChanges')}
                  </button>

                  <button
                    className="button button-primary"
                    disabled={
                      workspace.attendanceConflicts.length > 0
                    }
                    formAction={
                      finalizeAdminReportWorkspaceAction
                    }
                    type="submit"
                  >
                    {t('finalizeAndPrepare')}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <Alert variant="info">
                  {t('lockedReport')}
                </Alert>

                <section>
                  <h2>{mainReportLabel}</h2>

                  <p>
                    <strong>{t('englishField')}:</strong>{' '}
                    {workspace.mainReportEn ?? '—'}
                  </p>

                  <p dir="rtl">
                    <strong>{t('arabicField')}:</strong>{' '}
                    {workspace.mainReportAr ?? '—'}
                  </p>
                </section>

                {workspace.template.performanceEnabled ? (
                  <section>
                    <h2>{performanceLabel}</h2>
                    <p>
                      {workspace.performance
                        ? weekly(
                            `performance.${workspace.performance}`
                          )
                        : '—'}
                    </p>
                  </section>
                ) : null}

                <section>
                  <h2>{t('attendanceSummary')}</h2>
                  <p>
                    {t('attendanceCounts', {
                      present: totalPresent,
                      absent: totalAbsent
                    })}
                  </p>
                </section>

                {workspace.template.studentCommentsEnabled ? (
                  <section>
                    <h2>{studentCommentLabel}</h2>

                    {workspace.studentComments.length === 0 ? (
                      <EmptyState
                        title={t('noStudentComments')}
                      />
                    ) : (
                      <div className="stack-list">
                        {workspace.studentComments.map(
                          (student) => (
                            <article
                              className="record-card"
                              key={student.studentId}
                            >
                              <div className="record-card-main">
                                <h3>
                                  {localize(
                                    student.studentNameEn,
                                    student.studentNameAr
                                  )}
                                </h3>

                                {student.commentEn ? (
                                  <p>{student.commentEn}</p>
                                ) : null}

                                {student.commentAr ? (
                                  <p dir="rtl">
                                    {student.commentAr}
                                  </p>
                                ) : null}
                              </div>
                            </article>
                          )
                        )}
                      </div>
                    )}
                  </section>
                ) : null}
              </>
            )}

            <section>
              <h2>{t('attendanceCorrections')}</h2>

              {workspace.attendanceConflicts.length === 0 ? (
                <p>{t('noAttendanceConflicts')}</p>
              ) : (
                <AttendanceConflictList
                  conflicts={workspace.attendanceConflicts}
                  locale={locale}
                />
              )}
            </section>

            <div className="page-actions">
              {workspace.canReopen ? (
                <form
                  action={reopenAdminReportWorkspaceAction}
                >
                  {hiddenPeriod}

                  <input
                    name="batchId"
                    type="hidden"
                    value={workspace.batchId}
                  />

                  <button
                    className="button button-secondary"
                    type="submit"
                  >
                    {t('editReport')}
                  </button>
                </form>
              ) : null}

              {workspace.context.status ===
                'READY_TO_SEND' ||
              workspace.context.status ===
                'DELIVERY_ISSUE' ? (
                <form action={sendAdminReportBatchAction}>
                  {hiddenPeriod}

                  <input
                    name="batchId"
                    type="hidden"
                    value={workspace.batchId}
                  />

                  <button
                    className="button button-primary"
                    type="submit"
                  >
                    {workspace.context.status ===
                    'DELIVERY_ISSUE'
                      ? t('retryContextDelivery')
                      : t('sendContextReports')}
                  </button>
                </form>
              ) : null}
            </div>

            {workspace.reportIds.length > 0 ? (
              <p className="report-batch-meta">
                {t('generatedReports', {
                  count: workspace.reportIds.length
                })}
              </p>
            ) : null}
          </>
        )}
      </Card>
    </section>
  );
}
