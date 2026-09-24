import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {
  getStudentEnrollmentState,
  listEnrollmentClasses
} from '@/features/enrollment/enrollment.repository';
import {StudentEnrollmentEditor} from '@/features/students/student-enrollment-editor';
import {StudentForm} from '@/features/students/student-form';
import {getStudent} from '@/features/students/student.repository';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {getSchoolTimezone} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function EditStudentPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireProfile(locale, 'ADMIN');
  const [student, classes, timeZone] = await Promise.all([
    getStudent(profile.schoolId, id),
    listEnrollmentClasses(profile.schoolId),
    getSchoolTimezone(profile.schoolId)
  ]);
  if (!student) notFound();
  const today = todayInTimeZone(timeZone);
  const [enrollment, t] = await Promise.all([
    getStudentEnrollmentState(profile.schoolId, id, today),
    getTranslations({locale, namespace: 'students'})
  ]);

  return <AdminPage title={t('editTitle')} description={t('description')}>
    <StudentForm locale={locale} student={student} today={today} />
    <StudentEnrollmentEditor
      classes={classes}
      enrollment={enrollment}
      locale={locale}
      studentId={student.id}
      today={today}
    />
  </AdminPage>;
}
