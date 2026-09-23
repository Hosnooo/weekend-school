import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage, SecondaryLink} from '@/components/ui/admin-page';
import {renderStudentReport} from '@/features/reports/report.renderer';
import {getReport, listReportDeliveries} from '@/features/reports/report.repository';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function ReportPreviewPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireProfile(locale, 'ADMIN');
  const report = await getReport(profile.schoolId, id);
  if (!report) notFound();
  const [t, deliveries] = await Promise.all([
    getTranslations({locale, namespace: 'reports'}),
    listReportDeliveries(profile.schoolId, id)
  ]);
  const html = renderStudentReport(report.snapshot, report.language);
  const backHref = `/reports?periodStart=${report.periodStart}&periodEnd=${report.periodEnd}`;
  return <AdminPage title={t('previewTitle')} description={`${report.periodStart} – ${report.periodEnd}`} actions={<SecondaryLink href={backHref}>{t('back')}</SecondaryLink>}>
    <iframe className="report-preview" sandbox="" srcDoc={html} title={t('previewTitle')} />
    <section className="subsection" aria-labelledby="delivery-heading">
      <h2 id="delivery-heading">{t('deliveryHistory')}</h2>
      {deliveries.length === 0 ? <p>{t('noDeliveries')}</p> : <div className="table-wrap"><table>
        <thead><tr><th>{t('recipient')}</th><th>{t('status')}</th><th>{t('deliveryDate')}</th></tr></thead>
        <tbody>{deliveries.map((delivery) => <tr key={delivery.id}>
          <td>{delivery.recipient_email}</td><td>{t(`deliveryStatus.${delivery.status}`)}</td>
          <td>{new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(delivery.sent_at ?? delivery.created_at))}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </AdminPage>;
}
