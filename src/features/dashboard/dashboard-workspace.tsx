import {getTranslations} from 'next-intl/server';

import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {SectionHeader} from '@/components/ui/section-header';
import {AttendanceConflictList} from '@/features/attendance/attendance-conflict-list';
import type {getDashboardSummary} from '@/features/dashboard/dashboard.repository';
import type {ClassReportCycleListItem} from '@/features/reports/report-batch.repository';
import type {AdminTeachingUpdateRequestSet} from '@/features/teaching-updates/admin-teaching-update.types';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';

type DashboardSummary = Awaited<ReturnType<typeof getDashboardSummary>>;
type DashboardWork = {openRequestIds: string[]; activeCycleIds: string[]};

export async function DashboardWorkspace({
  locale,
  summary,
  requests,
  cycles,
  work
}: {
  locale: Locale;
  summary: DashboardSummary;
  requests: AdminTeachingUpdateRequestSet[];
  cycles: ClassReportCycleListItem[];
  work: DashboardWork;
}) {
  const [t, navigation, reports] = await Promise.all([
    getTranslations({locale, namespace: 'dashboard'}),
    getTranslations({locale, namespace: 'navigation'}),
    getTranslations({locale, namespace: 'reports'})
  ]);
  const schoolName = locale === 'ar' ? summary.schoolNameAr ?? summary.schoolNameEn : summary.schoolNameEn;
  const localize = (en: string, ar: string | null) => locale === 'ar' && ar ? ar : en;
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC'
  }).format(new Date(`${value}T12:00:00Z`));
  const formatPeriod = (start: string, end: string) => `${formatDate(start)} – ${formatDate(end)}`;
  const openRequests = requests.filter(({id}) => work.openRequestIds.includes(id));
  const activeCycles = cycles.filter(({id}) => work.activeCycleIds.includes(id));
  const hasAttention = openRequests.length > 0 || summary.teachersWithoutLogin > 0 ||
    summary.teachersWithoutAssignments > 0 || summary.conflicts.length > 0;

  return (
    <section className="admin-page">
      <PageHeader description={schoolName} title={navigation('dashboard')} />

      <section aria-label={t('attention')} className="dashboard-section">
        <SectionHeader title={t('attention')} />
        {hasAttention ? (
          <div className="dashboard-work-list">
            {openRequests.map((request) => (
              <div className="dashboard-work-row" key={request.id}>
                <div>
                  <strong className="record-name">{t('openRequest')}: {localize(request.classNameEn, request.classNameAr)} · {localize(request.subjectNameEn, request.subjectNameAr)}</strong>
                  <p className="record-meta">{formatPeriod(request.periodStart, request.periodEnd)}</p>
                </div>
                <Link className="button button-secondary button-compact action-link" href="/teaching-updates">{t('reviewUpdates')}</Link>
              </div>
            ))}
            {summary.teachersWithoutLogin > 0 ? (
              <div className="dashboard-work-row">
                <strong className="record-name">{t('teachersWithoutLogin')} · {summary.teachersWithoutLogin}</strong>
                <Link className="button button-secondary button-compact action-link" href="/teachers">{t('reviewTeachers')}</Link>
              </div>
            ) : null}
            {summary.teachersWithoutAssignments > 0 ? (
              <div className="dashboard-work-row">
                <strong className="record-name">{t('teachersWithoutAssignments')} · {summary.teachersWithoutAssignments}</strong>
                <Link className="button button-secondary button-compact action-link" href="/teaching-assignments">{t('manageAssignments')}</Link>
              </div>
            ) : null}
            {summary.conflicts.length > 0 ? (
              <div className="dashboard-conflicts" id="attendance-conflicts">
                <SectionHeader title={t('attendanceConflicts')} />
                <AttendanceConflictList conflicts={summary.conflicts} locale={locale} />
              </div>
            ) : null}
          </div>
        ) : <EmptyState title={t('noAttention')} description={t('noAttentionHelp')} />}
      </section>

      <section aria-label={t('inProgress')} className="dashboard-section">
        <SectionHeader title={t('inProgress')} />
        {activeCycles.length > 0 ? (
          <div className="dashboard-work-list">
            {activeCycles.map((cycle) => (
              <div className="dashboard-work-row" key={cycle.id}>
                <div>
                  <strong className="record-name">{localize(cycle.classNameEn, cycle.classNameAr)}</strong>
                  <p className="record-meta">{formatPeriod(cycle.periodStart, cycle.periodEnd)} · {cycle.status === 'DRAFT' ? reports('draft') : reports('review')}</p>
                </div>
                <Link className="button button-secondary button-compact action-link" href={`/reports/workspace/${cycle.id}`}>{t('openCycle')}</Link>
              </div>
            ))}
          </div>
        ) : <p className="muted-text">{t('noInProgress')}</p>}
      </section>

      <section aria-label={t('quickActions')} className="dashboard-section">
        <SectionHeader title={t('quickActions')} />
        <div className="page-actions">
          <Link className="button button-secondary action-link" href="/students/new">{t('addStudent')}</Link>
          <Link className="button button-secondary action-link" href="/teachers/new">{t('addTeacher')}</Link>
          <Link className="button button-primary action-link" href="/reports">{t('createReportCycle')}</Link>
        </div>
      </section>
    </section>
  );
}
