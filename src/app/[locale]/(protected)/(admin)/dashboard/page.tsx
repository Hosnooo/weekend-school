import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {ActionLink, AdminPage} from '@/components/ui/admin-page';
import {getDashboardSummary} from '@/features/dashboard/dashboard.repository';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function DashboardPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireProfile(locale, 'ADMIN');
  const [summary, t, navigation] = await Promise.all([
    getDashboardSummary(profile.schoolId),
    getTranslations({locale, namespace: 'dashboard'}),
    getTranslations({locale, namespace: 'navigation'})
  ]);
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'UTC'}).format(new Date(`${value}T12:00:00Z`));

  return <AdminPage
    title={navigation('dashboard')}
    description={`${locale === 'ar' ? summary.schoolNameAr : summary.schoolNameEn} · ${t('description')}`}
    actions={<ActionLink href="/groups">{t('viewGroups')}</ActionLink>}
  >
    <div className="dashboard-stats">
      <div className="dashboard-stat"><span>{t('students')}</span><strong>{summary.studentCount}</strong></div>
      <div className="dashboard-stat"><span>{t('teachers')}</span><strong>{summary.teacherCount}</strong></div>
      <div className="dashboard-stat"><span>{t('groups')}</span><strong>{summary.groupCount}</strong></div>
      <div className="dashboard-stat"><span>{t('readyReports')}</span><strong>{summary.readyReports}</strong></div>
      <div className="dashboard-stat"><span>{t('failedDeliveries')}</span><strong>{summary.failedDeliveries}</strong></div>
    </div>
    <section className="subsection dashboard-week" aria-labelledby="dashboard-week-heading">
      <div className="dashboard-week-heading">
        <div><h2 id="dashboard-week-heading">{t('thisWeek')}</h2><p>{formatDate(summary.start)} – {formatDate(summary.end)}</p></div>
        <strong>{t('submittedCount', {submitted: summary.submittedCount, total: summary.groupCount})}</strong>
      </div>
      {summary.groups.length === 0
        ? <p className="dashboard-empty">{t('noGroups')}</p>
        : <ul className="dashboard-group-list">{summary.groups.map((group) => <li key={group.id}>
          <span>{locale === 'ar' && group.nameAr ? group.nameAr : group.nameEn}</span>
          <span className={`status-badge ${group.submitted ? 'status-active' : 'status-inactive'}`}>
            {group.submitted ? t('submitted') : t('notSubmitted')}
          </span>
        </li>)}</ul>}
    </section>
  </AdminPage>;
}
