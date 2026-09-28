import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Card} from '@/components/ui/card';
import {TeachingUpdateTaskList} from '@/features/teaching-updates/teaching-update-task-list';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {Button} from '@/components/ui/button';
import {schoolWeekForDate} from '@/features/dashboard/dashboard.model';
import {TeacherSubjectGroupManager} from '@/features/classes/teacher-subject-group-manager';
import {listTeacherSubjectGroupManagement} from '@/features/classes/class.repository';
import {
  createTeachingUpdateAction
} from '@/features/teaching-updates/teaching-update.actions';
import {
  listOpenTeachingUpdates
} from '@/features/teaching-updates/teaching-update.repository';
import {
  todayInTimeZone
} from '@/features/weekly-updates/weekly-update.model';
import {
  getSchoolTimezone,
  listMyTeaching
} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
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

  const [contexts, openTeachingUpdates, t, teachingUpdates] =
    await Promise.all([
      listMyTeaching(
        profile.schoolId,
        teacherIds,
        today,
        weekStart
      ),
      listOpenTeachingUpdates(
        profile.schoolId,
        teacherIds
      ),
      getTranslations({
        locale,
        namespace: 'weekly'
      }),
      getTranslations({
        locale,
        namespace: 'teachingUpdates'
      })
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
        description={teachingUpdates('myTeachingDescription')}
        title={teachingUpdates('title')}
      />

      <TeachingUpdateTaskList
        contexts={contexts}
        locale={locale}
        updates={openTeachingUpdates}
      />

      {contexts.length === 0 ? (
        <EmptyState
          description={t('noTeachingHelp')}
          title={t('noTeaching')}
        />
      ) : (
        <div className="stack">
          <h2>{teachingUpdates('newUpdate')}</h2>

          <div className="group-cards">
            {contexts.map((context) => (
              <Card
                className="group-card"
                key={`${context.teacherId}:${context.classSubjectId}:${context.subjectGroupId ?? 'whole'}`}
              >
                <div>
                  <h3>
                    {localName(
                      context.subjectNameEn,
                      context.subjectNameAr
                    )}
                  </h3>

                  <p>
                    {localName(
                      context.classNameEn,
                      context.classNameAr
                    )}
                  </p>

                  <p>
                    {context.subjectGroupId
                      ? localName(
                          context.groupNameEn ?? '',
                          context.groupNameAr
                        )
                      : teachingUpdates(
                          'wholeSubject'
                        )}
                  </p>

                  <p>
                    {t('studentCount', {
                      count: context.studentCount
                    })}
                  </p>
                </div>

                <form action={createTeachingUpdateAction}>
                  <input
                    name="locale"
                    type="hidden"
                    value={locale}
                  />
                  <input
                    name="teacherId"
                    type="hidden"
                    value={context.teacherId}
                  />
                  <input
                    name="classSubjectId"
                    type="hidden"
                    value={context.classSubjectId}
                  />
                  <input
                    name="subjectGroupId"
                    type="hidden"
                    value={
                      context.subjectGroupId ?? ''
                    }
                  />
                  <input
                    name="onDate"
                    type="hidden"
                    value={today}
                  />

                  <Button type="submit">
                    {teachingUpdates('newUpdate')}
                  </Button>
                </form>
              </Card>
            ))}
          </div>
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
