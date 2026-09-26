import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Alert} from '@/components/ui/alert';
import {Badge} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';
import {DataTable} from '@/components/ui/data-table';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {Tabs} from '@/components/ui/tabs';
import {
  sendReadyReportsAction,
  sendReportAction
} from '@/features/email/email.actions';
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
import {
  getReportingTimezone,
  listReports
} from '@/features/reports/report.repository';
import {monthPeriod} from '@/features/reports/report.service';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';

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

  const periodStart =
    /^\d{4}-\d{2}-\d{2}$/.test(query.periodStart ?? '')
      ? query.periodStart!
      : defaults.periodStart;

  const periodEnd =
    /^\d{4}-\d{2}-\d{2}$/.test(query.periodEnd ?? '')
      ? query.periodEnd!
      : defaults.periodEnd;

  const [classes, reports, workspace, t, languages, common] =
    await Promise.all([
      listEnrollmentClasses(profile.schoolId),
      listReports(profile.schoolId, periodStart, periodEnd),
      query.batchId
        ? getReportBatchWorkspace(profile.schoolId, query.batchId)
        : Promise.resolve(null),
      getTranslations({locale, namespace: 'reports'}),
      getTranslations({locale, namespace: 'reportLanguages'}),
      getTranslations({locale, namespace: 'common'})
    ]);

  const activeClasses = classes.filter(({isActive}) => isActive);

  const subjects = activeClasses.flatMap((schoolClass) =>
    schoolClass.subjects
      .filter(({isActive}) => isActive)
      .map((subject) => ({
        ...subject,
        classId: schoolClass.id
      }))
  );

  const groups = subjects.flatMap((subject) =>
    subject.groups
      .filter(({isActive}) => isActive)
      .map((group) => ({
        ...group,
        classSubjectId: subject.id
      }))
  );

  const localize = (
    value: {nameEn: string; nameAr: string | null}
  ) =>
    locale === 'ar' && value.nameAr
      ? value.nameAr
      : value.nameEn;

  const defaultClassId =
    workspace?.batch.classId ?? activeClasses[0]?.id ?? '';

  const defaultSubjectId =
    workspace?.batch.classSubjectId ??
    subjects.find(({classId}) => classId === defaultClassId)?.id ??
    '';

  const defaultGroupId =
    workspace?.batch.subjectGroupId ??
    groups.find(
      ({classSubjectId}) => classSubjectId === defaultSubjectId
    )?.id ??
    '';

  const currentScope = workspace?.batch.scopeType ?? 'CLASS';

  const hiddenPeriod = (
    <>
      <input name="locale" type="hidden" value={locale} />
      <input
        name="periodStart"
        type="hidden"
        value={periodStart}
      />
      <input name="periodEnd" type="hidden" value={periodEnd} />
    </>
  );

  const batchHidden = workspace ? (
    <>
      {hiddenPeriod}
      <input
        name="batchId"
        type="hidden"
        value={workspace.batch.id}
      />
    </>
  ) : null;

  const statusLabel =
    workspace?.batch.status === 'FINALIZED'
      ? t('finalized')
      : workspace?.batch.status === 'REVIEW'
        ? t('review')
        : t('draft');

  const sourceLabels: ReportComposerLabels = {
    sources: t('sourceBlocks'),
    useTeacher: (name) => t('useTeacher', {name}),
    customProgressEn: t('customProgressEn'),
    customProgressAr: t('customProgressAr'),
    readiness: t('batchReadiness'),
    readyAutomatically: t('readyAutomatically'),
    personalizedComments: t('personalizedComments'),
    attendanceConflicts: t('attendanceConflicts'),
    missingData: t('missingData')
  };

  const sendableReports = reports.filter((report) => {
    const isPending =
      report.deliveryStatuses.includes('PENDING');

    return (
      !isPending &&
      (report.status === 'READY' || report.status === 'FAILED')
    );
  });

  const activeStage =
    workspace?.batch.status === 'FINALIZED'
      ? 'send'
      : workspace?.batch.status === 'REVIEW'
        ? 'finalize'
        : workspace
          ? 'review'
          : 'prepare';

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

      <Tabs
        defaultValue={activeStage}
        label={t('title')}
        items={[
          {
            value: 'prepare',
            label: t('prepareStage'),
            content: <p>{t('prepareStageHelp')}</p>
          },
          {
            value: 'review',
            label: t('reviewStage'),
            content: <p>{t('reviewStageHelp')}</p>
          },
          {
            value: 'finalize',
            label: t('finalizeStage'),
            content: <p>{t('finalizeStageHelp')}</p>
          },
          {
            value: 'send',
            label: t('sendStage'),
            content: <p>{t('sendStageHelp')}</p>
          }
        ]}
      />

      {query.error ? (
        <Alert variant="danger">
          {t(
            query.error === 'validation'
              ? 'validation'
              : query.error === 'send'
                ? 'sendError'
                : 'save'
          )}
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
        <h2>{t('prepareStage')}</h2>

        <form
          action={prepareReportBatchAction}
          className="record-form"
        >
          <input name="locale" type="hidden" value={locale} />

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

            <label>
              {t('class')}
              <select
                defaultValue={defaultClassId}
                name="classId"
                required
              >
                {activeClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {localize(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t('scope')}
              <select
                defaultValue={currentScope}
                name="scopeType"
              >
                <option value="CLASS">{t('classScope')}</option>
                <option value="SUBJECT">
                  {t('subjectScope')}
                </option>
                <option value="GROUP">{t('groupScope')}</option>
              </select>
            </label>

            <label>
              {t('subject')}
              <select
                defaultValue={defaultSubjectId}
                name="classSubjectId"
              >
                <option value="">—</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {localize(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t('group')}
              <select
                defaultValue={defaultGroupId}
                name="subjectGroupId"
              >
                <option value="">—</option>
                {groups.map((item) => (
                  <option key={item.id} value={item.id}>
                    {localize(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button className="button button-primary" type="submit">
            {t('prepareBatch')}
          </button>
        </form>
      </Card>

      {workspace ? (
        <Card className="content-section">
          <div className="dashboard-week-heading">
            <div>
              <h2>{t('batchReview')}</h2>
              <p>
                {workspace.batch.periodStart} –{' '}
                {workspace.batch.periodEnd}
              </p>
            </div>

            <Badge
              variant={
                workspace.batch.status === 'FINALIZED'
                  ? 'success'
                  : 'warning'
              }
            >
              {statusLabel}
            </Badge>
          </div>

          <ReportBatchSummary
            labels={sourceLabels}
            students={workspace.summaryStudents}
          />

          {workspace.sources.length === 0 ? (
            <EmptyState title={t('noSources')} />
          ) : (
            <ReportComposer
              labels={sourceLabels}
              sources={workspace.sources}
            />
          )}

          {workspace.batch.status === 'DRAFT' &&
          workspace.sources.length > 0 ? (
            <div className="page-actions">
              <form action={approveAllReportSourcesAction}>
                {batchHidden}
                <button
                  className="button button-secondary"
                  type="submit"
                >
                  {t('useAllSources')}
                </button>
              </form>

              <form action={reviewReportBatchAction}>
                {batchHidden}
                <button
                  className="button button-primary"
                  type="submit"
                >
                  {t('moveToReview')}
                </button>
              </form>
            </div>
          ) : null}

          {workspace.batch.status === 'REVIEW' ? (
            <form action={finalizeReportBatchAction}>
              {batchHidden}
              <button
                className="button button-primary"
                type="submit"
              >
                {t('finalizeReports')}
              </button>
            </form>
          ) : null}
        </Card>
      ) : null}

      <Card className="content-section">
        <div className="section-heading">
          <div>
            <h2>{t('sendStage')}</h2>
            <p>{t('sendStageHelp')}</p>
          </div>

          {sendableReports.length > 0 ? (
            <form action={sendReadyReportsAction}>
              {hiddenPeriod}
              <button
                className="button button-primary"
                type="submit"
              >
                {t('sendReady')}
              </button>
            </form>
          ) : null}
        </div>

        {reports.length === 0 ? (
          <EmptyState title={t('empty')} />
        ) : (
          <DataTable
            columns={[
              {
                key: 'student',
                header: t('student'),
                render: (report) =>
                  locale === 'ar' && report.studentNameAr
                    ? report.studentNameAr
                    : report.studentNameEn
              },
              {
                key: 'language',
                header: t('language'),
                render: (report) => languages(report.language)
              },
              {
                key: 'status',
                header: t('status'),
                render: (report) => {
                  const isPending =
                    report.deliveryStatuses.includes('PENDING');

                  const displayStatus = isPending
                    ? 'PENDING'
                    : report.status;

                  return (
                    <Badge
                      variant={
                        displayStatus === 'FAILED'
                          ? 'danger'
                          : displayStatus === 'PENDING'
                            ? 'warning'
                            : 'success'
                      }
                    >
                      {t(`reportStatus.${displayStatus}`)}
                    </Badge>
                  );
                }
              },
              {
                key: 'generated',
                header: t('generatedAt'),
                render: (report) =>
                  new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  }).format(new Date(report.generatedAt))
              },
              {
                key: 'actions',
                header: common('actions'),
                render: (report) => {
                  const isPending =
                    report.deliveryStatuses.includes('PENDING');

                  return (
                    <div className="row-actions">
                      <Link href={`/reports/${report.id}`}>
                        {t('preview')}
                      </Link>

                      {!isPending &&
                      (report.status === 'READY' ||
                        report.status === 'FAILED') ? (
                        <form action={sendReportAction}>
                          {hiddenPeriod}
                          <input
                            name="reportId"
                            type="hidden"
                            value={report.id}
                          />
                          <button
                            className="text-button"
                            type="submit"
                          >
                            {report.status === 'FAILED'
                              ? t('retry')
                              : t('send')}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  );
                }
              }
            ]}
            getRowKey={(report) => report.id}
            rows={reports}
          />
        )}
      </Card>
    </section>
  );
}
