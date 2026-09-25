import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Badge} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';
import {PageHeader} from '@/components/ui/page-header';
import {SectionHeader} from '@/components/ui/section-header';
import {StatusBadge} from '@/components/ui/status-badge';
import {classifyTeachingAssignments} from '@/features/teaching-assignments/teaching-assignment.service';
import {listTeachingAssignments} from '@/features/teaching-assignments/teaching-assignment.repository';
import {getTeacher, getTeacherAccessStates} from '@/features/teachers/teacher.repository';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {getSchoolTimezone} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function TeacherDetailPage({params}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [teacher, assignments, timeZone, t, common, language] = await Promise.all([
    getTeacher(profile.schoolId, id),
    listTeachingAssignments(profile.schoolId, id),
    getSchoolTimezone(profile.schoolId),
    getTranslations({locale, namespace: 'teachers'}),
    getTranslations({locale, namespace: 'common'}),
    getTranslations({locale, namespace: 'language'})
  ]);
  if (!teacher) notFound();

  const accessStates = await getTeacherAccessStates([teacher]);
  const accessState = teacher.authUserId ? accessStates[teacher.id] ?? 'unknown' : null;
  const classified = classifyTeachingAssignments(assignments, todayInTimeZone(timeZone));

  return (
    <section className="admin-page">
      <PageHeader
        actions={(
          <>
            <Link className="button button-secondary action-link" href={`/teachers/${teacher.id}/edit`}>{common('edit')}</Link>
            <Link className="button button-secondary action-link" href={`/teachers/${teacher.id}/access`}>{t('manageLoginAccess')}</Link>
            <Link className="button button-primary action-link" href={`/teachers/${teacher.id}/assignments`}>{t('assignments')}</Link>
          </>
        )}
        breadcrumbLabel={t('breadcrumbLabel')}
        breadcrumbs={[
          {label: t('title'), href: `/${locale}/teachers`},
          {label: teacher.displayName}
        ]}
        description={t('detailDescription')}
        title={teacher.displayName}
      />

      <div className="form-grid">
        <Card>
          <SectionHeader title={t('identityContact')} />
          <p><strong>{t('displayName')}:</strong> {teacher.displayName}</p>
          <p><strong>{t('email')}:</strong> {teacher.email ?? common('none')}</p>
          <p><strong>{t('preferredLanguage')}:</strong> {language(teacher.preferredLanguage === 'ar' ? 'arabic' : 'english')}</p>
        </Card>

        <Card>
          <SectionHeader title={t('loginAccess')} />
          <p>
            <Badge variant={teacher.authUserId ? 'info' : 'warning'}>
              {teacher.authUserId ? t('accountLinked') : t('noAccountLinked')}
            </Badge>
          </p>
          <p>{accessState ? t(accessState) : t('accessUnlinkedHelp')}</p>
          <Link className="button button-secondary action-link" href={`/teachers/${teacher.id}/access`}>{t('manageLoginAccess')}</Link>
        </Card>

        <Card>
          <SectionHeader title={t('teachingSummary')} />
          <p>{t('currentAssignmentCount', {count: classified.current.length})}</p>
          <p>{t('upcomingAssignmentCount', {count: classified.upcoming.length})}</p>
          <p>{t('pastAssignmentCount', {count: classified.past.length})}</p>
          <Link className="button button-secondary action-link" href={`/teachers/${teacher.id}/assignments`}>{t('manageTeachingAssignments')}</Link>
        </Card>

        <Card>
          <SectionHeader title={t('lifecycle')} />
          <p>
            <StatusBadge status={teacher.isActive ? 'active' : 'inactive'}>
              {teacher.isActive ? common('active') : common('inactive')}
            </StatusBadge>
          </p>
          <p>{teacher.isActive ? t('activeLifecycleHelp') : t('archivedLifecycleHelp')}</p>
        </Card>
      </div>
    </section>
  );
}
