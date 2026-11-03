import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Badge} from '@/components/ui/badge';
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

      <div className="detail-layout">
        <section className="detail-section">
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
        </section>

        <section className="detail-section">
          <SectionHeader title={t('enrollment')} />
          {enrollment.currentEnrollments.length ? (
            <div className="stack-list">
              {enrollment.currentEnrollments.map(({schoolClass, enrollment: dated, participation}) => (
                <div className="record-card" key={schoolClass.id}>
                  <h3>{localize(schoolClass)}</h3>
                  <p><strong>{t('enrollmentStart')}:</strong> {dated.startsOn}</p>
                  {participation.map((entry) => {
                    const subject = schoolClass.subjects.find((item) => item.id === entry.classSubjectId);
                    const group = subject?.groups.find((item) => item.id === entry.subjectGroupId);
                    return (
                      <p key={entry.classSubjectId}>
                        {locale === 'ar' && entry.nameAr ? entry.nameAr : entry.nameEn}
                        {' · '}
                        <Badge variant={entry.included ? 'success' : 'neutral'}>
                          {entry.included ? t('included') : t('excluded')}
                        </Badge>
                        {entry.included && group ? ` · ${localize(group)}` : ''}
                      </p>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : <p>{t('noCurrentClass')}</p>}

        </section>

        <section className="detail-section">
          <SectionHeader title={guardiansT('title')} />
          <StudentGuardianManager
            availableGuardians={availableGuardians}
            guardians={guardians}
            locale={locale}
            studentId={student.id}
          />
        </section>

        <section className="detail-section">
          <SectionHeader title={teachersT('lifecycle')} />
          <StatusBadge status={student.isActive ? 'active' : 'inactive'}>
            {student.isActive ? common('active') : common('inactive')}
          </StatusBadge>
        </section>
      </div>
    </section>
  );
}
