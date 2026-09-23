import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {EnrollmentPanel} from '@/features/enrollment/enrollment-panel';
import {getEnrollmentAdministration} from '@/features/enrollment/enrollment.repository';
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
  const [student, timeZone] = await Promise.all([
    getStudent(profile.schoolId, id),
    getSchoolTimezone(profile.schoolId)
  ]);
  if (!student) notFound();
  const t = await getTranslations({locale, namespace: 'students'});
  const today = todayInTimeZone(timeZone);
  const enrollment = await getEnrollmentAdministration(profile.schoolId, id, today);
  return <AdminPage title={t('editTitle')} description={t('description')}>
    <StudentForm groups={[]} locale={locale} student={student} today={today} />
    <EnrollmentPanel data={enrollment} locale={locale} studentId={id} today={today} labels={{enrollment:t('enrollment'),class:t('class'),changeClass:t('changeClass'),include:t('includeSubject'),exclude:t('excludeSubject'),group:t('subjectGroup'),changeGroup:t('changeSubjectGroup')}} />
  </AdminPage>;
}
