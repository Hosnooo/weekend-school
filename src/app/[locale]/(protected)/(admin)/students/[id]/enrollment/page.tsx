import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {getStudentEnrollmentState, listEnrollmentClasses} from '@/features/enrollment/enrollment.repository';
import {StudentEnrollmentEditor} from '@/features/students/student-enrollment-editor';
import {getStudent} from '@/features/students/student.repository';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {getSchoolTimezone} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function StudentEnrollmentPage({params}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [student, classes, timeZone, t] = await Promise.all([
    getStudent(profile.schoolId, id),
    listEnrollmentClasses(profile.schoolId),
    getSchoolTimezone(profile.schoolId),
    getTranslations({locale, namespace: 'students'})
  ]);
  if (!student) notFound();

  const today = todayInTimeZone(timeZone);
  const enrollment = await getStudentEnrollmentState(profile.schoolId, id, today);
  const studentName = locale === 'ar' && student.firstNameAr && student.lastNameAr
    ? `${student.firstNameAr} ${student.lastNameAr}`
    : `${student.firstNameEn} ${student.lastNameEn}`;

  return (
    <section className="admin-page">
      <PageHeader
        actions={<Link className="button button-secondary action-link" href={`/students/${student.id}`}>{studentName}</Link>}
        breadcrumbs={[
          {label: t('title'), href: `/${locale}/students`},
          {label: studentName, href: `/${locale}/students/${student.id}`},
          {label: t('manageEnrollment')}
        ]}
        description={t('enrollmentHelp')}
        title={t('manageEnrollment')}
      />
      <StudentEnrollmentEditor
        classes={classes}
        enrollment={enrollment}
        locale={locale}
        studentId={student.id}
        today={today}
      />
    </section>
  );
}
