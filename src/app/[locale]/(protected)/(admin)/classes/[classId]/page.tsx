import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {SectionHeader} from '@/components/ui/section-header';
import {ClassEditDialog} from '@/features/classes/class-edit-dialog';
import {ClassSubjectCard} from '@/features/classes/class-subject-card';
import {ClassSubjectForm} from '@/features/classes/class-subject-form';
import {
  getClassDetail,
  listSubjects
} from '@/features/classes/class.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function ClassDetailPage({
  params
}: {
  params: Promise<{locale: string; classId: string}>;
}) {
  const {locale, classId} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireAdministrator(locale);

  const [classDetail, subjects, t] = await Promise.all([
    getClassDetail(profile.schoolId, classId),
    listSubjects(profile.schoolId),
    getTranslations({locale, namespace: 'classes'})
  ]);

  if (!classDetail) notFound();

  const attachedSubjectIds = new Set(
    classDetail.subjects.map((subject) => subject.subjectId)
  );

  const availableSubjects = subjects.filter(
    (subject) => !attachedSubjectIds.has(subject.id)
  );

  const className =
    locale === 'ar' && classDetail.nameAr
      ? classDetail.nameAr
      : classDetail.nameEn;

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeZone: 'UTC'
    }).format(new Date(`${value}T12:00:00Z`));

  return (
    <section className="admin-page">
      <PageHeader
        actions={
          <>
            <Link
              className="button button-secondary action-link"
              href="/teaching-assignments"
            >
              {t('manageTeachingAssignments')}
            </Link>

            <ClassEditDialog
              classId={classDetail.id}
              locale={locale}
              endsOn={classDetail.endsOn}
              nameAr={classDetail.nameAr}
              nameEn={classDetail.nameEn}
              startsOn={classDetail.startsOn}
            />
          </>
        }
        breadcrumbLabel={t('breadcrumbLabel')}
        breadcrumbs={[
          {label: t('title'), href: `/${locale}/classes`},
          {label: className}
        ]}
        description={`${t('classDetailDescription')} ${t('classPeriodDescription', {
          start: formatDate(classDetail.startsOn),
          end: classDetail.endsOn
            ? formatDate(classDetail.endsOn)
            : t('ongoing')
        })}`}
        title={className}
      />

      <section className="content-section">
        <SectionHeader
          actions={
            <ClassSubjectForm
              classId={classDetail.id}
              locale={locale}
              subjects={availableSubjects}
            />
          }
          description={t('subjectsDescription')}
          title={t('subjects')}
        />

        {classDetail.subjects.length === 0 ? (
          <EmptyState title={t('noSubjects')} />
        ) : (
          <div className="subject-grid">
            {classDetail.subjects.map((subject) => (
              <ClassSubjectCard
                classId={classDetail.id}
                key={subject.id}
                locale={locale}
                subject={subject}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
