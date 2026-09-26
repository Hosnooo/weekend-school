import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Card} from '@/components/ui/card';
import {PageHeader} from '@/components/ui/page-header';
import {WeeklyUpdateForm} from '@/features/weekly-updates/weekly-update-form';
import {getWeeklySubmissionById} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {requireTeachingAccount} from '@/lib/auth/require-profile';

export default async function HistoryDetail({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();

  const {profile, teacherIds} = await requireTeachingAccount(locale);

  const submission = await getWeeklySubmissionById(
    profile.schoolId,
    teacherIds,
    id
  );

  if (!submission || submission.status !== 'SUBMITTED') {
    notFound();
  }

  const t = await getTranslations({
    locale,
    namespace: 'weekly'
  });

  const localName = (en: string, ar: string | null) =>
    locale === 'ar' && ar ? ar : en;

  const title = [
    localName(submission.classNameEn, submission.classNameAr),
    localName(submission.subjectNameEn, submission.subjectNameAr),
    submission.subjectGroupId
      ? localName(
          submission.groupNameEn ?? '',
          submission.groupNameAr
        )
      : t('wholeClass')
  ].join(' · ');

  const weekLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long'
  }).format(new Date(`${submission.weekStart}T12:00:00Z`));

  return (
    <section className="admin-page">
      <PageHeader
        description={t('weekOf', {date: weekLabel})}
        title={title}
      />

      <Card className="content-section">
        <WeeklyUpdateForm
          locale={locale}
          readOnly
          submission={submission}
        />
      </Card>
    </section>
  );
}
