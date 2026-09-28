import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Card} from '@/components/ui/card';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {StatusBadge} from '@/components/ui/status-badge';
import {schoolWeekForDate} from '@/features/dashboard/dashboard.model';
import {TeacherSubjectGroupManager} from '@/features/classes/teacher-subject-group-manager';
import {listTeacherSubjectGroupManagement} from '@/features/classes/class.repository';
import {
  todayInTimeZone,
  weeklyActionForStatus
} from '@/features/weekly-updates/weekly-update.model';
import {
  getSchoolTimezone,
  listMyTeaching
} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireTeachingAccount} from '@/lib/auth/require-profile';

export default async function MyTeachingPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  const {profile, teacherIds} = await requireTeachingAccount(locale);
  const timeZone = await getSchoolTimezone(profile.schoolId);
  const today = todayInTimeZone(timeZone);
  const weekStart = schoolWeekForDate(today).start;

  const [contexts, t] = await Promise.all([
    listMyTeaching(profile.schoolId, teacherIds, today, weekStart),
    getTranslations({locale, namespace: 'weekly'})
  ]);

  const classSubjectIds = [
    ...new Set(contexts.map(({classSubjectId}) => classSubjectId))
  ];
  const groupManagement = await Promise.all(
    classSubjectIds.map((classSubjectId) =>
      listTeacherSubjectGroupManagement(classSubjectId, today)
    )
  );

  const localName = (en: string, ar: string | null) =>
    locale === 'ar' && ar ? ar : en;

  return (
    <section className="admin-page">
      <PageHeader
        description={t('myTeachingDescription')}
        title={t('thisWeek')}
      />

      {contexts.length === 0 ? (
        <EmptyState
          description={t('noTeachingHelp')}
          title={t('noTeaching')}
        />
      ) : (
        <div className="group-cards">
          {contexts.map((context) => {
            const actionKey = weeklyActionForStatus(context.status);

            return (
              <Card
                className="group-card"
                key={`${context.teacherId}:${context.classSubjectId}:${context.subjectGroupId ?? 'whole'}`}
              >
                <div className="section-heading">
                  <div>
                    <h2>
                      {localName(
                        context.subjectNameEn,
                        context.subjectNameAr
                      )}
                    </h2>
                    <p>
                      {localName(
                        context.classNameEn,
                        context.classNameAr
                      )}
                    </p>
                  </div>

                  <StatusBadge
                    status={
                      context.status === 'SUBMITTED'
                        ? 'active'
                        : 'inactive'
                    }
                  >
                    {t(`submissionStatus.${context.status}`)}
                  </StatusBadge>
                </div>

                <div className="detail-list">
                  <p>
                    <strong>{t('class')}:</strong>{' '}
                    {localName(
                      context.classNameEn,
                      context.classNameAr
                    )}
                  </p>

                  <p>
                    <strong>{t('subject')}:</strong>{' '}
                    {localName(
                      context.subjectNameEn,
                      context.subjectNameAr
                    )}
                  </p>

                  <p>
                    <strong>{t('group')}:</strong>{' '}
                    {context.subjectGroupId
                      ? localName(
                          context.groupNameEn ?? '',
                          context.groupNameAr
                        )
                      : t('wholeClass')}
                  </p>

                  <p>{t('studentCount', {count: context.studentCount})}</p>
                </div>

                <Link
                  className="button button-primary action-link"
                  href={`/my-teaching/update?teacherId=${context.teacherId}&classSubjectId=${context.classSubjectId}&subjectGroupId=${context.subjectGroupId ?? ''}&week=${context.weekStart}`}
                >
                  {t(actionKey)}
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      {groupManagement.length > 0 ? (
        <div className="stack">
          {groupManagement.map((management) => {
            const context = contexts.find(
              ({classSubjectId}) =>
                classSubjectId === management.classSubjectId
            );

            return context ? (
              <TeacherSubjectGroupManager
                classNameAr={context.classNameAr}
                classNameEn={context.classNameEn}
                key={management.classSubjectId}
                locale={locale}
                management={management}
                subjectNameAr={context.subjectNameAr}
                subjectNameEn={context.subjectNameEn}
                today={today}
              />
            ) : null;
          })}
        </div>
      ) : null}
    </section>
  );
}
