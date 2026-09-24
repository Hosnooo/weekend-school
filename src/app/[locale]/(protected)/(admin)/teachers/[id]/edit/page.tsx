import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {
  listTeachingAssignments,
  listTeachingClassSubjects
} from '@/features/teaching-assignments/teaching-assignment.repository';
import {TeacherForm, TeachingAssignmentEditor} from '@/features/teachers/teacher-form';
import {getTeacher} from '@/features/teachers/teacher.repository';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {getSchoolTimezone} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function EditTeacherPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [teacher, classSubjects, assignments, timeZone] = await Promise.all([
    getTeacher(profile.schoolId, id),
    listTeachingClassSubjects(profile.schoolId),
    listTeachingAssignments(profile.schoolId, id),
    getSchoolTimezone(profile.schoolId)
  ]);
  if (!teacher) notFound();
  const t = await getTranslations({locale, namespace: 'teachers'});
  const today = todayInTimeZone(timeZone);
  const description = locale === 'ar'
    ? 'عدّل سجل المعلم وتعيينات التدريس بشكل مستقل عن حساب الدخول.'
    : 'Edit the Teacher record and teaching assignments independently from account access.';
  return <AdminPage title={t('editTitle')} description={description}>
    <TeacherForm locale={locale} teacher={teacher}/>
    <TeachingAssignmentEditor
      assignments={assignments}
      classSubjects={classSubjects}
      locale={locale}
      teacherId={teacher.id}
      today={today}
    />
  </AdminPage>;
}
