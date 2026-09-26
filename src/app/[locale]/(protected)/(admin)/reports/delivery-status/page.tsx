import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Badge} from '@/components/ui/badge';
import {DataTable} from '@/components/ui/data-table';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {
  listDeliveryStatusRows,
  type DeliveryStatusGroup
} from '@/features/reports/report.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';

const filters = ['PENDING', 'SENT', 'FAILED'] as const;

export default async function DeliveryStatusPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{status?: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireProfile(locale, 'ADMIN');
  const query = await searchParams;

  const filter: DeliveryStatusGroup | undefined =
    filters.includes(query.status as DeliveryStatusGroup)
      ? (query.status as DeliveryStatusGroup)
      : undefined;

  const [rows, t, languages, common] = await Promise.all([
    listDeliveryStatusRows(profile.schoolId, filter),
    getTranslations({locale, namespace: 'reports'}),
    getTranslations({locale, namespace: 'reportLanguages'}),
    getTranslations({locale, namespace: 'common'})
  ]);

  const studentName = (row: (typeof rows)[number]) =>
    locale === 'ar' && row.studentNameAr
      ? row.studentNameAr
      : row.studentNameEn;

  const badgeVariant = (
    status: DeliveryStatusGroup
  ): 'success' | 'warning' | 'danger' => {
    if (status === 'SENT') return 'success';
    if (status === 'FAILED') return 'danger';
    return 'warning';
  };

  return (
    <section className="admin-page">
      <PageHeader
        actions={
          <Link
            className="button button-secondary action-link"
            href="/reports"
          >
            {t('back')}
          </Link>
        }
        description={t('deliveryStatusDescription')}
        title={t('deliveryStatusTitle')}
      />

      <nav
        aria-label={t('deliveryStatusTitle')}
        className="page-actions"
      >
        <Link
          className="button button-secondary action-link"
          href="/reports/delivery-status"
        >
          {t('deliveryAll')}
        </Link>
        <Link
          className="button button-secondary action-link"
          href="/reports/delivery-status?status=PENDING"
        >
          {t('deliveryPending')}
        </Link>
        <Link
          className="button button-secondary action-link"
          href="/reports/delivery-status?status=SENT"
        >
          {t('deliverySent')}
        </Link>
        <Link
          className="button button-secondary action-link"
          href="/reports/delivery-status?status=FAILED"
        >
          {t('deliveryFailed')}
        </Link>
      </nav>

      {rows.length === 0 ? (
        <EmptyState title={t('deliveryEmpty')} />
      ) : (
        <DataTable
          columns={[
            {
              key: 'student',
              header: t('student'),
              render: (row) => studentName(row)
            },
            {
              key: 'recipient',
              header: t('deliveryRecipient'),
              render: (row) => (
                <span dir="ltr">{row.recipientEmail}</span>
              )
            },
            {
              key: 'period',
              header: t('deliveryPeriod'),
              render: (row) => (
                <span dir="ltr">
                  {row.periodStart} – {row.periodEnd}
                </span>
              )
            },
            {
              key: 'language',
              header: t('language'),
              render: (row) => languages(row.language)
            },
            {
              key: 'status',
              header: t('status'),
              render: (row) => (
                <Badge variant={badgeVariant(row.groupStatus)}>
                  {row.groupStatus === 'PENDING'
                    ? t('deliveryPending')
                    : row.groupStatus === 'SENT'
                      ? t('deliverySent')
                      : t('deliveryFailed')}
                </Badge>
              )
            },
            {
              key: 'activity',
              header: t('deliveryDate'),
              render: (row) => (
                <bdi>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  }).format(new Date(row.occurredAt))}
                </bdi>
              )
            },
            {
              key: 'error',
              header: t('deliveryError'),
              render: (row) => row.errorMessage ?? common('none')
            },
            {
              key: 'report',
              header: t('deliveryReport'),
              render: (row) => (
                <Link href={`/reports/${row.reportId}`}>
                  {t('preview')}
                </Link>
              )
            }
          ]}
          getRowKey={(row) => row.id}
          rows={rows}
        />
      )}
    </section>
  );
}
