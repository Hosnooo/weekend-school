import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Alert} from '@/components/ui/alert';
import {PageHeader} from '@/components/ui/page-header';
import {getActiveReportTemplate} from '@/features/reports/report-template.repository';
import {reopenWeeklySubmissionAction} from '@/features/weekly-updates/weekly-update.actions';
import {TeachingUpdateEditor} from '@/features/teaching-updates/teaching-update-editor';
import {getTeachingUpdate} from '@/features/teaching-updates/teaching-update.repository';
import {formatTeachingUpdateRange} from '@/features/teaching-updates/teaching-update-date';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {getSchoolTimezone} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {requireTeachingAccount} from '@/lib/auth/require-profile';

export default async function HistoryDetail({
  params,
  searchParams
}: {
  params: Promise<{locale: string; id: string}>;
  searchParams: Promise<{error?: string}>;
}) {
  const [{locale, id}, query] = await Promise.all([
    params,
    searchParams
  ]);
  if (!isLocale(locale)) notFound();

  const {profile, teacherIds} = await requireTeachingAccount(locale);

  const [submission, template, timeZone] = await Promise.all([
    getTeachingUpdate(
      profile.schoolId,
      teacherIds,
      id
    ),
    getActiveReportTemplate(profile.schoolId),
    getSchoolTimezone(profile.schoolId)
  ]);

  if (!submission || submission.status !== 'SUBMITTED' || !submission.teacherId) {
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

  const coverageLabel = formatTeachingUpdateRange(
    submission.periodStart,
    submission.periodEnd,
    locale
  );

  return (
    <section className="admin-page">
      <PageHeader
        description={coverageLabel}
        title={title}
      />

      {query.error === 'reopen' ? (
        <Alert variant="warning">
          {t('reopenBlocked')}
        </Alert>
      ) : null}

      <form
        action={reopenWeeklySubmissionAction}
        className="page-actions"
      >
        <input
          name="locale"
          type="hidden"
          value={locale}
        />
        <input
          name="submissionId"
          type="hidden"
          value={submission.id}
        />
        <input
          name="teacherId"
          type="hidden"
          value={submission.teacherId}
        />
        <input
          name="classSubjectId"
          type="hidden"
          value={submission.classSubjectId}
        />
        <input
          name="subjectGroupId"
          type="hidden"
          value={submission.subjectGroupId ?? ''}
        />
        <input
          name="weekStart"
          type="hidden"
          value={submission.periodStart}
        />

        <button
          className="button button-secondary"
          type="submit"
        >
          {t('reopenAndEdit')}
        </button>
      </form>

      <div className="detail-section history-detail-content">
        <TeachingUpdateEditor
          locale={locale}
          teacherId={submission.teacherId}
          today={todayInTimeZone(timeZone)}
          update={submission}
          template={template}
        />
      </div>
    </section>
  );
}
