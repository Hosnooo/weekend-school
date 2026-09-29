import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {getActiveReportTemplate} from '@/features/reports/report-template.repository';
import {formatTeachingUpdateRange} from '@/features/teaching-updates/teaching-update-date';
import {
  TeachingUpdateEditor
} from '@/features/teaching-updates/teaching-update-editor';
import {
  getTeachingUpdate
} from '@/features/teaching-updates/teaching-update.repository';
import {
  todayInTimeZone
} from '@/features/weekly-updates/weekly-update.model';
import {
  getSchoolTimezone
} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {requireTeachingAccount} from '@/lib/auth/require-profile';
import {databaseUuid} from '@/lib/validation/fields';

export default async function TeachingUpdatePage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    submissionId?: string;
  }>;
}) {
  const [{locale}, query] = await Promise.all([
    params,
    searchParams
  ]);

  if (!isLocale(locale)) notFound();

  const submissionId =
    databaseUuid.safeParse(query.submissionId);

  if (!submissionId.success) notFound();

  const {profile, teacherIds} =
    await requireTeachingAccount(locale);

  const [update, template, timeZone, t] =
    await Promise.all([
      getTeachingUpdate(
        profile.schoolId,
        teacherIds,
        submissionId.data
      ),
      getActiveReportTemplate(profile.schoolId),
      getSchoolTimezone(profile.schoolId),
      getTranslations({
        locale,
        namespace: 'teachingUpdates'
      })
    ]);

  if (!update) notFound();

  const teacherId =
    update.teacherId &&
    teacherIds.includes(update.teacherId)
      ? update.teacherId
      : teacherIds[0];

  if (!teacherId) notFound();

  const today = todayInTimeZone(timeZone);

  const localName = (
    english: string,
    arabic: string | null
  ) => locale === 'ar' && arabic ? arabic : english;

  const contextName = [
    localName(
      update.classNameEn,
      update.classNameAr
    ),
    localName(
      update.subjectNameEn,
      update.subjectNameAr
    ),
    update.subjectGroupId
      ? localName(
          update.groupNameEn ?? '',
          update.groupNameAr
        )
      : t('wholeSubject')
  ].join(' · ');

  const coverage =
    update.coverageKind === 'DATES'
      ? `${t('dateCount', {count: update.dates.length})} · ${formatTeachingUpdateRange(update.periodStart, update.periodEnd, locale)}`
      : formatTeachingUpdateRange(update.periodStart, update.periodEnd, locale);

  return (
    <section className="admin-page">
      <PageHeader
        description={coverage}
        title={contextName}
      />

      <TeachingUpdateEditor
        locale={locale}
        teacherId={teacherId}
        template={template}
        today={today}
        update={update}
      />
    </section>
  );
}
