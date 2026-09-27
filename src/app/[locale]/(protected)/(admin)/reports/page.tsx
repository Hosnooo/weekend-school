import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {
  Badge,
  type BadgeVariant
} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';
import {ConfirmSubmitButton} from '@/components/ui/confirm-submit-button';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {listAdminReportContexts} from '@/features/reports/admin-report-contexts.repository';
import type {AdminReportContextStatus} from '@/features/reports/admin-report-contexts';
import {sendAdminReportBatchAction} from '@/features/reports/admin-report-delivery.actions';
import {openAdminReportContextAction} from '@/features/reports/admin-report-workflow.actions';
import {getReportingTimezone} from '@/features/reports/report.repository';
import {monthPeriod} from '@/features/reports/report.service';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';

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
    error?: string;
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

  const [contexts, t] = await Promise.all([
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

      {query.error ? (
        <p className="form-error">
          {query.error === 'validation'
            ? t('validation')
            : t('saveError')}
        </p>
      ) : null}

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
                {contexts.map((context) => {
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
                            <form action={sendAdminReportBatchAction}>
                              {hiddenPeriod}

                              <input
                                name="batchId"
                                type="hidden"
                                value={context.batchId}
                              />
                              <input
                                name="returnTo"
                                type="hidden"
                                value="queue"
                              />

                              <ConfirmSubmitButton
                                className="button button-primary"
                                confirmMessage={`${
                                  context.status === 'DELIVERY_ISSUE'
                                    ? t('retryContextDelivery')
                                    : t('sendContextReports')
                                }?`}
                                type="submit"
                              >
                                {context.status === 'DELIVERY_ISSUE'
                                  ? t('retryContextDelivery')
                                  : t('sendContextReports')}
                              </ConfirmSubmitButton>
                            </form>
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
      </Card>
    </section>
  );
}
