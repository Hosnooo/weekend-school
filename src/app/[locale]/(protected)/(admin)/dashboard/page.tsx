import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Card} from '@/components/ui/card';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {SectionHeader} from '@/components/ui/section-header';
import {AttendanceConflictList} from '@/features/attendance/attendance-conflict-list';
import {getDashboardSummary} from '@/features/dashboard/dashboard.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function DashboardPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireAdministrator(locale);

  const [summary, t, navigation] = await Promise.all([
    getDashboardSummary(profile.schoolId),
    getTranslations({locale, namespace: 'dashboard'}),
    getTranslations({locale, namespace: 'navigation'})
  ]);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeZone: 'UTC'
    }).format(new Date(`${value}T12:00:00Z`));

  const schoolName =
    locale === 'en'
      ? summary.schoolNameEn
      : summary.schoolNameAr ?? summary.schoolNameEn;

  const attentionCount = [
    summary.teachersWithoutLogin,
    summary.teachersWithoutAssignments,
    summary.missingCount,
    summary.unresolvedAttendanceConflicts,
    summary.readyReports,
    summary.failedDeliveries
  ].filter((count) => count > 0).length;

  return (
    <section className="admin-page">
      <PageHeader
        actions={
          <Link
            className="button button-primary action-link"
            href="/students/new"
          >
            {t('addStudent')}
          </Link>
        }
        description={`${schoolName} · ${t('description')}`}
        title={navigation('dashboard')}
      />

      <section
        aria-labelledby="quick-actions-heading"
        className="subsection"
      >
        <SectionHeader title={t('quickActions')} />

        <div className="page-actions">
          <Link
            className="button button-secondary action-link"
            href="/teachers/new"
          >
            {t('addTeacher')}
          </Link>

          <Link
            className="button button-secondary action-link"
            href="/teaching-assignments"
          >
            {t('assignTeacher')}
          </Link>

          <Link
            className="button button-secondary action-link"
            href="/classes/new"
          >
            {t('addClass')}
          </Link>

          <Link
            className="button button-secondary action-link"
            href="/reports"
          >
            {t('reports')}
          </Link>
        </div>
      </section>

      <section aria-labelledby="attention-heading" className="subsection">
        <div id="attention-heading">
          <SectionHeader
            description={t('attentionDescription')}
            title={t('attention')}
          />
        </div>

        {attentionCount === 0 ? (
          <EmptyState
            description={t('noAttentionHelp')}
            title={t('noAttention')}
          />
        ) : (
          <div className="dashboard-stats">
            {summary.teachersWithoutLogin > 0 ? (
              <Card className="dashboard-stat">
                <span>{t('teachersWithoutLogin')}</span>
                <strong>{summary.teachersWithoutLogin}</strong>
                <p className="muted-text">
                  {t('teachersWithoutLoginHelp')}
                </p>
                <Link
                  className="button button-secondary button-compact action-link"
                  href="/teachers"
                >
                  {t('reviewTeachers')}
                </Link>
              </Card>
            ) : null}

            {summary.teachersWithoutAssignments > 0 ? (
              <Card className="dashboard-stat">
                <span>{t('teachersWithoutAssignments')}</span>
                <strong>{summary.teachersWithoutAssignments}</strong>
                <p className="muted-text">
                  {t('teachersWithoutAssignmentsHelp')}
                </p>
                <Link
                  className="button button-secondary button-compact action-link"
                  href="/teaching-assignments"
                >
                  {t('manageAssignments')}
                </Link>
              </Card>
            ) : null}

            {summary.missingCount > 0 ? (
              <Card className="dashboard-stat">
                <span>{t('missingUpdates')}</span>
                <strong>{summary.missingCount}</strong>
                <p className="muted-text">{t('missingUpdatesHelp')}</p>
                <a
                  className="button button-secondary button-compact action-link"
                  href="#this-week"
                >
                  {t('reviewWeek')}
                </a>
              </Card>
            ) : null}

            {summary.unresolvedAttendanceConflicts > 0 ? (
              <Card className="dashboard-stat">
                <span>{t('attendanceConflicts')}</span>
                <strong>{summary.unresolvedAttendanceConflicts}</strong>
                <p className="muted-text">
                  {t('attendanceConflictsHelp')}
                </p>
                <a
                  className="button button-secondary button-compact action-link"
                  href="#attendance-conflicts"
                >
                  {t('reviewConflicts')}
                </a>
              </Card>
            ) : null}

            {summary.readyReports > 0 ? (
              <Card className="dashboard-stat">
                <span>{t('readyReports')}</span>
                <strong>{summary.readyReports}</strong>
                <p className="muted-text">{t('readyReportsHelp')}</p>
                <Link
                  className="button button-secondary button-compact action-link"
                  href="/reports"
                >
                  {t('reviewReports')}
                </Link>
              </Card>
            ) : null}

            {summary.failedDeliveries > 0 ? (
              <Card className="dashboard-stat">
                <span>{t('failedDeliveries')}</span>
                <strong>{summary.failedDeliveries}</strong>
                <p className="muted-text">{t('failedDeliveriesHelp')}</p>
                <Link
                  className="button button-secondary button-compact action-link"
                  href="/reports"
                >
                  {t('reviewReports')}
                </Link>
              </Card>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="school-overview-heading" className="subsection">
        <div id="school-overview-heading">
          <SectionHeader title={t('schoolOverview')} />
        </div>

        <div className="dashboard-stats">
          <Card className="dashboard-stat">
            <span>{t('students')}</span>
            <strong>{summary.studentCount}</strong>
          </Card>

          <Card className="dashboard-stat">
            <span>{t('teachers')}</span>
            <strong>{summary.teacherCount}</strong>
          </Card>
        </div>
      </section>

      <section
        aria-labelledby="dashboard-week-heading"
        className="subsection dashboard-week"
        id="this-week"
      >
        <SectionHeader
          actions={
            <strong>
              {summary.submittedCount} / {summary.expectedCount}{' '}
              {t('submitted')}
            </strong>
          }
          description={`${formatDate(summary.start)} – ${formatDate(summary.end)}`}
          title={t('thisWeek')}
        />

        {summary.expectedCount === 0 ? (
          <p className="dashboard-empty">{t('noTeaching')}</p>
        ) : (
          <div className="dashboard-stats">
            <Card className="dashboard-stat">
              <span>{t('submitted')}</span>
              <strong>{summary.submittedCount}</strong>
            </Card>

            <Card className="dashboard-stat">
              <span>{t('draft')}</span>
              <strong>{summary.draftCount}</strong>
            </Card>

            <Card className="dashboard-stat">
              <span>{t('missing')}</span>
              <strong>{summary.missingCount}</strong>
            </Card>
          </div>
        )}
      </section>

      <section
        aria-labelledby="attendance-conflicts-heading"
        className="subsection"
        id="attendance-conflicts"
      >
        <div id="attendance-conflicts-heading">
          <SectionHeader
            description={t('conflictsHelp')}
            title={t('attendanceConflicts')}
          />
        </div>

        {summary.conflicts.length === 0 ? (
          <p className="dashboard-empty">{t('noConflicts')}</p>
        ) : (
          <AttendanceConflictList
            conflicts={summary.conflicts}
            locale={locale}
          />
        )}
      </section>
    </section>
  );
}
