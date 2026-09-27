import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AttendanceConflictList} from '@/features/attendance/attendance-conflict-list';
import {Alert} from '@/components/ui/alert';
import {
  Badge,
  type BadgeVariant
} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {
  listAdminReportContexts
} from '@/features/reports/admin-report-contexts.repository';
import type {
  AdminReportContextStatus
} from '@/features/reports/admin-report-contexts';
import {
  sendAdminReportBatchAction
} from '@/features/reports/admin-report-delivery.actions';
import {
  finalizeAdminReportWorkspaceAction,
  openAdminReportContextAction,
  reopenAdminReportWorkspaceAction,
  saveAdminReportWorkspaceAction
} from '@/features/reports/admin-report-workflow.actions';
import {
  getAdminReportWorkspace
} from '@/features/reports/admin-report-workspace.repository';
import {
  getReportingTimezone
} from '@/features/reports/report.repository';
import {monthPeriod} from '@/features/reports/report.service';
import type {ReportPerformance} from '@/features/reports/report.types';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
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

function statusVariant(
  status: AdminReportContextStatus
): BadgeVariant {
  if (status === 'SENT') return 'success';
  if (status === 'DELIVERY_ISSUE') return 'danger';
  if (status === 'READY_TO_SEND') return 'info';
  if (status === 'READY_FOR_REVIEW') return 'warning';
  return 'neutral';
}

export default async function ReportsPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    periodStart?: string;
    periodEnd?: string;
    batchId?: string;
    error?: string;
    saved?: string;
    finalized?: string;
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

  let periodStart =
    /^\d{4}-\d{2}-\d{2}$/.test(query.periodStart ?? '')
      ? query.periodStart!
      : defaults.periodStart;

  let periodEnd =
    /^\d{4}-\d{2}-\d{2}$/.test(query.periodEnd ?? '')
      ? query.periodEnd!
      : defaults.periodEnd;

  if (periodEnd < periodStart) {
    periodStart = defaults.periodStart;
    periodEnd = defaults.periodEnd;
  }

  const parsedBatchId = databaseUuid.safeParse(query.batchId);
  const requestedBatchId = parsedBatchId.success
    ? parsedBatchId.data
    : null;

  const [contexts, workspace, t, weekly] = await Promise.all([
    listAdminReportContexts(
      profile.schoolId,
      periodStart,
      periodEnd
    ),
    requestedBatchId
      ? getAdminReportWorkspace(
          profile.schoolId,
          requestedBatchId
        )
      : Promise.resolve(null),
    getTranslations({
      locale,
      namespace: 'reports'
    }),
    getTranslations({
      locale,
      namespace: 'weekly'
    })
  ]);

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

  const hiddenPeriod = (
    <>
      <input name="locale" type="hidden" value={locale} />
      <input
        name="periodStart"
        type="hidden"
        value={periodStart}
      />
      <input
        name="periodEnd"
        type="hidden"
        value={periodEnd}
      />
    </>
  );

  const totalPresent =
    workspace?.attendanceSummary.reduce(
      (sum, student) => sum + student.presentCount,
      0
    ) ?? 0;

  const totalAbsent =
    workspace?.attendanceSummary.reduce(
      (sum, student) => sum + student.absentCount,
      0
    ) ?? 0;

  const mainReportLabel = workspace
    ? localize(
        workspace.template.mainReportLabelEn,
        workspace.template.mainReportLabelAr,
        t('reportWorkspace')
      )
    : '';

  const mainReportHelp = workspace
    ? localize(
        workspace.template.mainReportHelpEn,
        workspace.template.mainReportHelpAr,
        ''
      )
    : '';

  const performanceLabel = workspace
    ? localize(
        workspace.template.performanceLabelEn,
        workspace.template.performanceLabelAr,
        t('performance')
      )
    : '';

  const studentCommentLabel = workspace
    ? localize(
        workspace.template.studentCommentLabelEn,
        workspace.template.studentCommentLabelAr,
        t('studentCommentsTitle')
      )
    : '';

  return (
    <section className="admin-page">
      <PageHeader
        actions={
          <Link
            className="button button-secondary action-link"
            href="/reports/delivery-status"
          >
            {t('viewDeliveryStatus')}
          </Link>
        }
        description={t('description')}
        title={t('title')}
      />

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

      <Card className="content-section">
        <h2>{t('periodFilter')}</h2>

        <form className="record-form" method="get">
          <div className="form-grid">
            <label>
              {t('periodStart')}
              <input
                defaultValue={periodStart}
                name="periodStart"
                required
                type="date"
              />
            </label>

            <label>
              {t('periodEnd')}
              <input
                defaultValue={periodEnd}
                name="periodEnd"
                required
                type="date"
              />
            </label>
          </div>

          <button
            className="button button-secondary"
            type="submit"
          >
            {t('applyPeriod')}
          </button>
        </form>
      </Card>

      <Card className="content-section">
        <div className="section-heading">
          <div>
            <h2>{t('contextsTitle')}</h2>
            <p>{t('contextsHelp')}</p>
          </div>
        </div>

        {contexts.length === 0 ? (
          <EmptyState title={t('noContexts')} />
        ) : (
          <div className="stack-list">
            {contexts.map((context) => {
              const groupName = context.groupNameEn
                ? localize(
                    context.groupNameEn,
                    context.groupNameAr
                  )
                : null;

              return (
                <article
                  className="record-card"
                  key={`${context.classSubjectId}:${context.subjectGroupId ?? 'whole'}`}
                >
                  <div className="record-card-main">
                    <h3>
                      {localize(
                        context.classNameEn,
                        context.classNameAr
                      )}
                      {' · '}
                      {localize(
                        context.subjectNameEn,
                        context.subjectNameAr
                      )}
                      {groupName ? ` · ${groupName}` : ''}
                    </h3>

                    <p>
                      <strong>{t('teachers')}:</strong>{' '}
                      {context.teacherNames.length > 0
                        ? context.teacherNames.join(', ')
                        : t('noTeacher')}
                    </p>

                    <p>
                      {t('submissionCount', {
                        count: context.submissionCount
                      })}
                      {' · '}
                      {t('studentCommentCount', {
                        count: context.studentCommentCount
                      })}
                    </p>
                  </div>

                  <div className="row-actions">
                    <Badge
                      variant={statusVariant(context.status)}
                    >
                      {t(`contextStatus.${context.status}`)}
                    </Badge>

                    <form action={openAdminReportContextAction}>
                      {hiddenPeriod}
                      <input
                        name="classId"
                        type="hidden"
                        value={context.classId}
                      />
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
                        {t('openReport')}
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      {workspace ? (
        <Card className="content-section report-workspace">
          <div className="dashboard-week-heading">
            <div>
              <h2>{t('reportWorkspace')}</h2>
              <p>
                {localize(
                  workspace.context.classNameEn,
                  workspace.context.classNameAr
                )}
                {' · '}
                {localize(
                  workspace.context.subjectNameEn,
                  workspace.context.subjectNameAr
                )}
                {workspace.context.groupNameEn
                  ? ` · ${localize(
                      workspace.context.groupNameEn,
                      workspace.context.groupNameAr
                    )}`
                  : ''}
              </p>
              <p className="report-batch-meta">
                {workspace.periodStart} – {workspace.periodEnd}
                {' · '}
                {workspace.context.teacherNames.length > 0
                  ? workspace.context.teacherNames.join(', ')
                  : t('noTeacher')}
                {' · '}
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
                    <h3>{mainReportLabel}</h3>
                    {mainReportHelp ? <p>{mainReportHelp}</p> : null}

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
                      <label>
                        {performanceLabel}
                        <select
                          defaultValue={
                            workspace.performance ?? ''
                          }
                          name="performance"
                        >
                          <option value="">—</option>
                          {performanceValues.map((value) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {weekly(
                                `performance.${value}`
                              )}
                            </option>
                          ))}
                        </select>
                      </label>
                    </section>
                  ) : null}

                  <section>
                    <h3>{t('attendanceSummary')}</h3>
                    <p>
                      {t('attendanceCounts', {
                        present: totalPresent,
                        absent: totalAbsent
                      })}
                    </p>
                  </section>

                  {workspace.template.studentCommentsEnabled ? (
                    <section>
                      <h3>{studentCommentLabel}</h3>

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
                                  <h4>
                                    {localize(
                                      student.studentNameEn,
                                      student.studentNameAr
                                    )}
                                  </h4>

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
                    <h3>{mainReportLabel}</h3>
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
                      <h3>{performanceLabel}</h3>
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
                    <h3>{t('attendanceSummary')}</h3>
                    <p>
                      {t('attendanceCounts', {
                        present: totalPresent,
                        absent: totalAbsent
                      })}
                    </p>
                  </section>

                  {workspace.template.studentCommentsEnabled ? (
                    <section>
                      <h3>{studentCommentLabel}</h3>
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
                                  <h4>
                                    {localize(
                                      student.studentNameEn,
                                      student.studentNameAr
                                    )}
                                  </h4>
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
                <h3>{t('attendanceCorrections')}</h3>

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
      ) : null}
    </section>
  );
}
