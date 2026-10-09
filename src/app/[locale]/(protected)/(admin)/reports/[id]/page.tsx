import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Card} from '@/components/ui/card';
import {DataTable} from '@/components/ui/data-table';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {getClassReportCycleLivePreview} from '@/features/reports/class-report-finalization.repository';
import {StatusBadge} from '@/components/ui/status-badge';
import {
  renderStudentReport,
  renderStudentReportV2
} from '@/features/reports/report.renderer';
import {ReportPreviewFrame} from '@/features/reports/report-preview-frame';
import {
  getReport,
  listReportDeliveries
} from '@/features/reports/report.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';
import {createServerSupabaseClient} from '@/lib/supabase/server';

export default async function ReportPreviewPage({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireProfile(locale, 'ADMIN');
  const report = await getReport(profile.schoolId, id);

  if (!report) notFound();

  const [t, deliveries] = await Promise.all([
    getTranslations({locale, namespace: 'reports'}),
    listReportDeliveries(profile.schoolId, id)
  ]);

  // Unsent stored snapshots may predate Administrator corrections.
  // The live approval resolver is authoritative until the cycle is finalized.
  let effectiveSnapshot = report.snapshot;
  const db = await createServerSupabaseClient();
  const {data: source, error: sourceError} = await db.from('reports')
    .select('batch_id,report_batches(status,scope_type)')
    .eq('school_id', profile.schoolId)
    .eq('id', id)
    .maybeSingle();
  if (sourceError) throw sourceError;
  const batch = source?.report_batches as unknown as
    | {status: string; scope_type: string}
    | null;
  if (batch?.status !== 'FINALIZED' && batch?.scope_type === 'CLASS' && source?.batch_id) {
    const live = await getClassReportCycleLivePreview(
      profile.schoolId,
      source.batch_id,
      report.studentId
    );
    if (live?.snapshot) effectiveSnapshot = live.snapshot;
  }

  const html =
    effectiveSnapshot.version === 2
      ? renderStudentReportV2(effectiveSnapshot, report.language)
      : renderStudentReport(effectiveSnapshot, report.language);

  const backHref =
    `/reports?periodStart=${report.periodStart}` +
    `&periodEnd=${report.periodEnd}`;

  const periodLabel =
    `${report.periodStart} – ${report.periodEnd}`;

  const isolatedPeriodLabel =
    locale === 'ar'
      ? `\u2066${periodLabel}\u2069`
      : periodLabel;

  return (
    <section className="admin-page">
      <PageHeader
        actions={
          <div className="page-actions">
            <Link
              className="button button-secondary action-link"
              href={backHref}
            >
              {t('back')}
            </Link>

            <Link
              className="button button-secondary action-link"
              href="/reports/delivery-status"
            >
              {t('viewDeliveryStatus')}
            </Link>
          </div>
        }
        description={isolatedPeriodLabel}
        title={t('previewTitle')}
      />

      <Card className="content-section">
        <ReportPreviewFrame
          html={html}
          title={t('previewTitle')}
        />
      </Card>

      <Card className="content-section">
        <h2>{t('deliveryHistory')}</h2>

        {deliveries.length === 0 ? (
          <EmptyState title={t('noDeliveries')} />
        ) : (
          <DataTable
            columns={[
              {
                key: 'recipient',
                header: t('recipient'),
                render: (delivery) => (
                  <span dir="ltr">
                    {delivery.recipient_email}
                  </span>
                )
              },
              {
                key: 'status',
                header: t('status'),
                render: (delivery) => (
                  <StatusBadge
                    status={
                      delivery.status === 'SENT' ||
                      delivery.status === 'DELIVERED'
                        ? 'active'
                        : 'inactive'
                    }
                  >
                    {t(
                      `deliveryStatus.${delivery.status}`
                    )}
                  </StatusBadge>
                )
              },
              {
                key: 'date',
                header: t('deliveryDate'),
                render: (delivery) => (
                  <bdi>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    }).format(
                      new Date(
                        delivery.sent_at ??
                          delivery.created_at
                      )
                    )}
                  </bdi>
                )
              }
            ]}
            getRowKey={(delivery) => delivery.id}
            rows={deliveries}
          />
        )}
      </Card>
    </section>
  );
}
