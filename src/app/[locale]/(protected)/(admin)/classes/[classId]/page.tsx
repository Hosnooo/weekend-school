import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage, SecondaryLink} from '@/components/ui/admin-page';
import {ClassSubjectCard} from '@/features/classes/class-subject-card';
import {ClassSubjectForm} from '@/features/classes/class-subject-form';
import {getClassDetail, listSubjects} from '@/features/classes/class.repository';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function ClassDetailPage({
  params
}: {
  params: Promise<{locale: string; classId: string}>;
}) {
  const {locale, classId} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireProfile(locale, 'ADMIN');
  const [classDetail, subjects] = await Promise.all([
    getClassDetail(profile.schoolId, classId),
    listSubjects(profile.schoolId)
  ]);
  if (!classDetail) notFound();

  const t = await getTranslations({locale, namespace: 'classes'});
  const attachedSubjectIds = new Set(classDetail.subjects.map((subject) => subject.subjectId));
  const availableSubjects = subjects.filter((subject) => !attachedSubjectIds.has(subject.id));
  const className =
    locale === 'ar' && classDetail.nameAr ? classDetail.nameAr : classDetail.nameEn;

  return (
    <AdminPage
      title={className}
      description={t('classDetailDescription')}
      actions={<SecondaryLink href="/classes">{t('backToClasses')}</SecondaryLink>}
    >
      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>{t('subjects')}</h2>
            <p>{t('subjectsDescription')}</p>
          </div>
        </div>

        <ClassSubjectForm
          classId={classDetail.id}
          locale={locale}
          subjects={availableSubjects}
        />

        {classDetail.subjects.length === 0 ? (
          <p className="empty-state">{t('noSubjects')}</p>
        ) : (
          <div className="subject-grid">
            {classDetail.subjects.map((subject) => (
              <ClassSubjectCard
                key={subject.id}
                classId={classDetail.id}
                locale={locale}
                subject={subject}
              />
            ))}
          </div>
        )}
      </section>
    </AdminPage>
  );
}
