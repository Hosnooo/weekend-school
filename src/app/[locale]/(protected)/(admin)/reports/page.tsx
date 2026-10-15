import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {
  Badge,
  type BadgeVariant
} from '@/components/ui/badge';
import {ConfirmSubmitButton} from '@/components/ui/confirm-submit-button';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {listClasses} from '@/features/classes/class.repository';
import {listAdminReportContexts} from '@/features/reports/admin-report-contexts.repository';
import type {AdminReportContextStatus} from '@/features/reports/admin-report-contexts';
import {GuardianDeliveryPanel} from '@/features/reports/guardian-delivery-panel';
import {GuardianDeliveryOutcome} from '@/features/reports/guardian-delivery-outcome';
import {
  cancelClassReportCycleAction,
  createClassReportCycleAction,
  requestAllReportCycleMissingUpdatesAction,
  openAdminReportContextAction
} from '@/features/reports/admin-report-workflow.actions';
import {listClassReportCycles, type ClassReportCycleListItem} from '@/features/reports/report-batch.repository';
import {ReportCyclesAutoRefresh} from '@/features/reports/report-cycles-auto-refresh';
import type {ClassReportCycleDisplayStatus} from '@/features/reports/class-report-cycle-status';
import {getReportingTimezone} from '@/features/reports/report.repository';
import {monthPeriod} from '@/features/reports/report.service';
import {formatTeachingUpdateRange} from '@/features/teaching-updates/teaching-update-date';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';

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

function cycleStatusVariant(
  status: ClassReportCycleDisplayStatus
): BadgeVariant {
  if (status === 'SENT') return 'success';
  if (status === 'DELIVERY_ISSUE') return 'danger';
  if (status === 'REVIEW' || status === 'READY_TO_SEND') return 'info';
  return 'warning';
}

export default async function ReportsPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    periodStart?: string;
    periodEnd?: string;
    error?: string;
    cancelled?: string;
    requested?: string;
    sent?: string;
    failed?: string;
    skipped?: string;
    missing?: string;
    already?: string;
    pending?: string;
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

  const [
    classes,
    cycles,
    contexts,
    t
  ] = await Promise.all([
    listClasses(profile.schoolId),
    listClassReportCycles(profile.schoolId),
    listAdminReportContexts(
      profile.schoolId,
      periodStart,
      periodEnd
    ),
    getTranslations({
      locale,
      namespace: 'reports'
    })
  ]);

  const activeClasses = classes.filter(
    ({isActive}) => isActive
  );
  const pendingPeriods = [...new Map(
    cycles.filter((cycle) => cycle.status !== 'FINALIZED').map((cycle) => [
      `${cycle.periodStart}:${cycle.periodEnd}`,
      {start: cycle.periodStart, end: cycle.periodEnd}
    ])
  ).values()];

  const historicalContexts = contexts.filter(
    ({batchId}) => Boolean(batchId)
  );
  const openCycles = cycles.filter(({displayStatus}) => displayStatus !== 'SENT');
  const sentCycles = cycles
    .filter(({displayStatus}) => displayStatus === 'SENT')
    .sort((left, right) =>
      (right.latestSentAt ?? right.createdAt).localeCompare(
        left.latestSentAt ?? left.createdAt
      )
    );

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

  const renderCycle = (cycle: ClassReportCycleListItem) => (
    <article className="report-cycle-row" key={cycle.id}>
      <div>
        <div className="row-actions">
          <strong className="record-name">
            {localize(cycle.classNameEn, cycle.classNameAr)}
          </strong>
          <Badge variant={cycleStatusVariant(cycle.displayStatus)}>
            {t(`cycleStatus.${cycle.displayStatus}`)}
          </Badge>
        </div>
        <p className="record-meta">
          {formatTeachingUpdateRange(cycle.periodStart, cycle.periodEnd, locale)}
        </p>
        {cycle.status === 'FINALIZED' ? (
          <p className="record-meta">
            {t('cycleDeliveryCounts', {
              sent: cycle.sentReportCount,
              ready: cycle.readyReportCount,
              failed: cycle.failedReportCount
            })}
          </p>
        ) : null}
        {cycle.latestSentAt ? (
          <p className="record-meta">
            {t('cycleLastSent', {
              date: new Intl.DateTimeFormat(locale === 'ar' ? 'ar-CA' : 'en-CA', {
                timeZone: timezone,
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              }).format(new Date(cycle.latestSentAt))
            })}
          </p>
        ) : null}
      </div>
      <div className="row-actions">
        <Link
          className="button button-secondary action-link"
          href={`/reports/workspace/${cycle.id}`}
        >
          {t('openCycle')}
        </Link>
        {cycle.canDismiss ? (
          <form action={cancelClassReportCycleAction}>
            <input name="locale" type="hidden" value={locale} />
            <input name="batchId" type="hidden" value={cycle.id} />
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
    </article>
  );

  return (
    <section className="admin-page">
      <ReportCyclesAutoRefresh />
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
      <GuardianDeliveryOutcome locale={locale} result={query}/>

      <section className="report-cycle-active detail-section">
        {query.cancelled ? (
          <p className="form-success">{t('cycleDismissed')}</p>
        ) : null}
        {query.requested !== undefined ? (
          <p className="form-success">
            {t('bulkRequestResult', {count: Number(query.requested) || 0})}
          </p>
        ) : null}
        {query.error ? (
          <p className="form-error">
            {userReportError(t, query.error)}
          </p>
        ) : null}
        <div className="section-heading">
          <div>
            <h2>{t('openReportCyclesTitle')}</h2>
            <p>{t('openReportCyclesHelp')}</p>
          </div>
        </div>

        {pendingPeriods.length > 0 ? (
          <div className="stack">
            {pendingPeriods.map((period) => (
              <div className="report-cycle-row" key={`${period.start}:${period.end}`}>
                <span className="record-meta">
                  {formatTeachingUpdateRange(period.start, period.end, locale)}
                </span>
                <form action={requestAllReportCycleMissingUpdatesAction}>
                  <input name="locale" type="hidden" value={locale} />
                  <input name="periodStart" type="hidden" value={period.start} />
                  <input name="periodEnd" type="hidden" value={period.end} />
                  <ConfirmSubmitButton
                    className="button button-secondary"
                    confirmMessage={t('requestAllMissingConfirm')}
                    type="submit"
                  >
                    {t('requestAllMissing')}
                  </ConfirmSubmitButton>
                </form>
              </div>
            ))}
          </div>
        ) : null}
        {openCycles.length === 0 ? (
          <EmptyState title={t('noOpenReportCycles')} />
        ) : (
          <div className="stack-list">
            {openCycles.map(renderCycle)}
          </div>
        )}
      </section>

      <section className="report-cycle-recent detail-section">
        <div className="section-heading">
          <div>
            <h2>{t('recentlySentCyclesTitle')}</h2>
            <p>{t('recentlySentCyclesHelp')}</p>
          </div>
        </div>
        {sentCycles.length === 0 ? (
          <EmptyState title={t('noSentReportCycles')} />
        ) : (
          <>
            <div className="stack-list">
              {sentCycles.slice(0, 5).map(renderCycle)}
            </div>
            {sentCycles.length > 5 ? (
              <details className="report-cycle-history">
                <summary>{t('olderSentCycles', {count: sentCycles.length - 5})}</summary>
                <div className="stack-list">
                  {sentCycles.slice(5).map(renderCycle)}
                </div>
              </details>
            ) : null}
          </>
        )}
      </section>

      <details className="report-cycle-create">
        <summary>{t('createReportCycle')}</summary>
        <p className="record-meta">{t('createReportCycleHelp')}</p>

        <form
          action={createClassReportCycleAction}
          className="record-form"
        >
          <input
            name="locale"
            type="hidden"
            value={locale}
          />

          <div className="form-grid">
            <label>
              {t('classLabel')}
              <select
                name="classId"
                required
              >
                <option value="">
                  {t('chooseClass')}
                </option>

                {activeClasses.map((schoolClass) => (
                  <option
                    key={schoolClass.id}
                    value={schoolClass.id}
                  >
                    {localize(
                      schoolClass.nameEn,
                      schoolClass.nameAr
                    )}
                  </option>
                ))}
              </select>
            </label>

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
            className="button button-primary"
            disabled={activeClasses.length === 0}
            type="submit"
          >
            {t('createCycle')}
          </button>
        </form>
      </details>

      <details className="report-cycle-history">
        <summary>{t('historicalReportsTitle')}</summary>
        <p className="record-meta">{t('historicalReportsHelp')}</p>

      <section className="detail-section report-history-filter">
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
      </section>

      <section className="detail-section">

        {historicalContexts.length === 0 ? (
          <EmptyState title={t('noContexts')} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('contextsTitle')}</th>
                  <th>{t('teachers')}</th>
                  <th>{t('teacherUpdates')}</th>
                  <th>{t('openReport')}</th>
                </tr>
              </thead>

              <tbody>
                {historicalContexts.map((context) => {
                  const groupName = context.groupNameEn
                    ? localize(
                        context.groupNameEn,
                        context.groupNameAr
                      )
                    : null;

                  return (
                    <tr
                      key={`${context.classSubjectId}:${context.subjectGroupId ?? 'whole'}`}
                    >
                      <td>
                        <strong>
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
                        </strong>

                        <div className="report-batch-meta">
                          <Badge
                            variant={statusVariant(context.status)}
                          >
                            {t(
                              `contextStatus.${context.status}`
                            )}
                          </Badge>
                        </div>
                      </td>

                      <td>
                        {context.teacherNames.length > 0
                          ? context.teacherNames.join(', ')
                          : t('noTeacher')}
                      </td>

                      <td>
                        <div>
                          {t('submissionCount', {
                            count: context.submissionCount
                          })}
                        </div>
                        <div className="report-batch-meta">
                          {t('studentCommentCount', {
                            count: context.studentCommentCount
                          })}
                        </div>
                      </td>

                      <td>
                        <div className="row-actions">
                          {(context.status === 'READY_TO_SEND' ||
                            context.status === 'DELIVERY_ISSUE') &&
                            context.batchId ? (
                            <GuardianDeliveryPanel
                              schoolId={profile.schoolId}
                              batchId={context.batchId}
                              periodStart={periodStart}
                              periodEnd={periodEnd}
                              locale={locale}
                              returnTo="queue"
                            />
                          ) : null}

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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </details>
    </section>
  );
}
