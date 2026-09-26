import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Card} from '@/components/ui/card';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {StatusBadge} from '@/components/ui/status-badge';
import {listTeachers} from '@/features/teachers/teacher.repository';
import {isLocale} from '@/i18n/config';
import {requireTeachingAccount} from '@/lib/auth/require-profile';

export default async function TeacherProfilePage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  const {profile, teacherIds} = await requireTeachingAccount(locale);

  const [teachers, t, common] = await Promise.all([
    listTeachers(profile.schoolId),
    getTranslations({
      locale,
      namespace: 'teacherProfile'
    }),
    getTranslations({
      locale,
      namespace: 'common'
    })
  ]);

  const teacherRecords = teachers.filter((teacher) =>
    teacherIds.includes(teacher.id)
  );

  return (
    <section className="admin-page">
      <PageHeader
        description={t('description')}
        title={t('title')}
      />

      <Card className="subsection">
        <h2>{t('identity')}</h2>

        <div className="detail-list">
          <p>
            <strong>{profile.displayName}</strong>
          </p>

          <p>
            <strong>{t('preferredLanguage')}:</strong>{' '}
            {t(
              profile.preferredLanguage === 'ar'
                ? 'arabic'
                : 'english'
            )}
          </p>
        </div>
      </Card>

      <Card className="subsection">
        <h2>{t('teacherRecords')}</h2>

        {teacherRecords.length === 0 ? (
          <EmptyState title={t('noTeacherRecords')} />
        ) : (
          <div className="group-cards">
            {teacherRecords.map((teacher) => (
              <Card className="group-card" key={teacher.id}>
                <div className="section-heading">
                  <div>
                    <h3>{teacher.displayName}</h3>
                    <p>{teacher.email ?? common('none')}</p>
                  </div>

                  <StatusBadge
                    status={
                      teacher.isActive ? 'active' : 'inactive'
                    }
                  >
                    {teacher.isActive
                      ? common('active')
                      : common('inactive')}
                  </StatusBadge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
