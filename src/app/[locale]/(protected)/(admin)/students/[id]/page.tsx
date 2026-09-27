import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Badge} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';
import {PageHeader} from '@/components/ui/page-header';
import {SectionHeader} from '@/components/ui/section-header';
import {StatusBadge} from '@/components/ui/status-badge';
import {getStudentEnrollmentState} from '@/features/enrollment/enrollment.repository';
import {
  listGuardians,
  listStudentGuardians
} from '@/features/guardians/guardian.repository';
import {StudentGuardianManager} from '@/features/guardians/student-guardian-manager';
import {getStudent} from '@/features/students/student.repository';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {getSchoolTimezone} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function StudentDetailPage({params}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireAdministrator(locale);
  const [student, timeZone, t, common, guardiansT, teachersT] =
    await Promise.all([
      getStudent(profile.schoolId, id),
      getSchoolTimezone(profile.schoolId),
      getTranslations({locale, namespace: 'students'}),
      getTranslations({locale, namespace: 'common'}),
      getTranslations({locale, namespace: 'guardians'}),
      getTranslations({locale, namespace: 'teachers'})
    ]);

  if (!student) notFound();

  const today = todayInTimeZone(timeZone);
  const [enrollment, guardians, guardianDirectory] = await Promise.all([
    getStudentEnrollmentState(profile.schoolId, student.id, today),
    listStudentGuardians(profile.schoolId, student.id),
    listGuardians(profile.schoolId)
  ]);

  const linkedGuardianIds = new Set(
    guardians.map((guardian) => guardian.id)
  );
  const availableGuardians = guardianDirectory.filter(
    (guardian) => !linkedGuardianIds.has(guardian.id)
  );

  const studentName =
    locale === 'ar' && student.firstNameAr && student.lastNameAr
      ? `${student.firstNameAr} ${student.lastNameAr}`
      : `${student.firstNameEn} ${student.lastNameEn}`;

  const localize = (value: {nameEn: string; nameAr: string | null}) =>
    locale === 'ar' && value.nameAr ? value.nameAr : value.nameEn;

  return (
    <section className="admin-page">
      <PageHeader
        breadcrumbLabel={t('breadcrumbLabel')}
        actions={(
          <>
            <Link
              className="button button-secondary action-link"
              href={`/students/${student.id}/edit`}
            >
              {common('edit')}
            </Link>
            <Link
              className="button button-primary action-link"
              href={`/students/${student.id}/enrollment`}
            >
              {t('manageEnrollment')}
            </Link>
          </>
        )}
        breadcrumbs={[
          {label: t('title'), href: `/${locale}/students`},
          {label: studentName}
        ]}
        description={t('description')}
        title={studentName}
      />

      <div className="form-grid">
        <Card>
          <SectionHeader title={teachersT('identityContact')} />
          <p><strong>{t('firstNameEn')}:</strong> {student.firstNameEn}</p>
          <p><strong>{t('lastNameEn')}:</strong> {student.lastNameEn}</p>
          <p>
            <strong>{t('firstNameAr')}:</strong>{' '}
            {student.firstNameAr ?? common('none')}
          </p>
          <p>
            <strong>{t('lastNameAr')}:</strong>{' '}
            {student.lastNameAr ?? common('none')}
          </p>
        </Card>

        <Card>
          <SectionHeader title={t('enrollment')} />
          <p>
            <strong>{t('currentClass')}:</strong>{' '}
            {enrollment.currentClass
              ? localize(enrollment.currentClass)
              : common('notAssigned')}
          </p>

          {enrollment.currentEnrollment ? (
            <p>
              <strong>{t('enrollmentStart')}:</strong>{' '}
              {enrollment.currentEnrollment.startsOn}
            </p>
          ) : null}

          {enrollment.participation.length > 0 ? (
            <div className="stack-list">
              {enrollment.participation.map((participation) => {
                const subject = enrollment.currentClass?.subjects.find(
                  (item) => item.id === participation.classSubjectId
                );
                const group = subject?.groups.find(
                  (item) => item.id === participation.subjectGroupId
                );

                return (
                  <div key={participation.classSubjectId}>
                    <strong>
                      {locale === 'ar' && participation.nameAr
                        ? participation.nameAr
                        : participation.nameEn}
                    </strong>
                    <div>
                      <Badge
                        variant={participation.included ? 'success' : 'neutral'}
                      >
                        {participation.included
                          ? t('included')
                          : t('excluded')}
                      </Badge>
                      {' '}
                      {participation.included
                        ? group
                          ? localize(group)
                          : subject?.groups.some(({isActive}) => isActive)
                            ? t('groupAssignmentNeeded')
                            : common('notAssigned')
                        : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <Link
            className="button button-secondary action-link"
            href={`/students/${student.id}/enrollment`}
          >
            {t('manageEnrollment')}
          </Link>
        </Card>

        <Card>
          <SectionHeader title={guardiansT('title')} />
          <StudentGuardianManager
            availableGuardians={availableGuardians}
            guardians={guardians}
            locale={locale}
            studentId={student.id}
          />
        </Card>

        <Card>
          <SectionHeader title={teachersT('lifecycle')} />
          <StatusBadge status={student.isActive ? 'active' : 'inactive'}>
            {student.isActive ? common('active') : common('inactive')}
          </StatusBadge>
        </Card>
      </div>
    </section>
  );
}
