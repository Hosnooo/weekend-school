import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {ActionLink, AdminPage} from '@/components/ui/admin-page';
import {AttendanceConflictList} from '@/features/attendance/attendance-conflict-list';
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
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC'
  }).format(new Date(`${value}T12:00:00Z`));
  const labels = locale === 'ar'
    ? {
        expectedUpdates: 'تحديثات التدريس المتوقعة',
        attendanceConflicts: 'تعارضات الحضور',
        submitted: 'تم التسليم',
        draft: 'مسودة',
        missing: 'لم يبدأ',
        noTeaching: 'لا توجد تحديثات تدريس متوقعة لهذا الأسبوع.',
        conflictsTitle: 'تعارضات الحضور',
        conflictsHelp: 'راجع اختلافات حضور المعلمين واعتمد حالة الحضور الرسمية.',
        noConflicts: 'لا توجد تعارضات حضور غير محلولة لهذا الأسبوع.'
      }
    : {
        expectedUpdates: 'Expected teaching updates',
        attendanceConflicts: 'Attendance conflicts',
        submitted: 'Submitted',
        draft: 'Draft',
        missing: 'Missing',
        noTeaching: 'No teaching updates are expected this week.',
        conflictsTitle: 'Attendance conflicts',
        conflictsHelp: 'Review differing teacher observations and choose the official attendance status.',
        noConflicts: 'No unresolved attendance conflicts this week.'
      };
  const schoolName = locale === 'ar' && summary.schoolNameAr
    ? summary.schoolNameAr
    : summary.schoolNameEn;

  return <AdminPage
    title={navigation('dashboard')}
    description={`${schoolName} · ${t('description')}`}
    actions={<ActionLink href="/reports">{navigation('reports')}</ActionLink>}
  >
    <div className="dashboard-stats">
      <div className="dashboard-stat"><span>{t('students')}</span><strong>{summary.studentCount}</strong></div>
      <div className="dashboard-stat"><span>{t('teachers')}</span><strong>{summary.teacherCount}</strong></div>
      <div className="dashboard-stat"><span>{labels.expectedUpdates}</span><strong>{summary.expectedCount}</strong></div>
      <div className="dashboard-stat"><span>{labels.attendanceConflicts}</span><strong>{summary.unresolvedAttendanceConflicts}</strong></div>
      <div className="dashboard-stat"><span>{t('readyReports')}</span><strong>{summary.readyReports}</strong></div>
      <div className="dashboard-stat"><span>{t('failedDeliveries')}</span><strong>{summary.failedDeliveries}</strong></div>
    </div>

    <section className="subsection dashboard-week" aria-labelledby="dashboard-week-heading">
      <div className="dashboard-week-heading">
        <div>
          <h2 id="dashboard-week-heading">{t('thisWeek')}</h2>
          <p>{formatDate(summary.start)} – {formatDate(summary.end)}</p>
        </div>
        <strong>{summary.submittedCount} / {summary.expectedCount} {labels.submitted}</strong>
      </div>
      {summary.expectedCount === 0
        ? <p className="dashboard-empty">{labels.noTeaching}</p>
        : <div className="dashboard-stats">
          <div className="dashboard-stat"><span>{labels.submitted}</span><strong>{summary.submittedCount}</strong></div>
          <div className="dashboard-stat"><span>{labels.draft}</span><strong>{summary.draftCount}</strong></div>
          <div className="dashboard-stat"><span>{labels.missing}</span><strong>{summary.missingCount}</strong></div>
        </div>}
    </section>

    <section className="subsection" aria-labelledby="attendance-conflicts-heading">
      <h2 id="attendance-conflicts-heading">{labels.conflictsTitle}</h2>
      <p>{labels.conflictsHelp}</p>
      {summary.conflicts.length === 0
        ? <p className="dashboard-empty">{labels.noConflicts}</p>
        : <AttendanceConflictList locale={locale} conflicts={summary.conflicts} />}
    </section>
  </AdminPage>;
}
