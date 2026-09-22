import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {listGroups} from '@/features/groups/group.repository';
import {StudentForm} from '@/features/students/student-form';
import {StudentTransferForm} from '@/features/students/student-transfer-form';
import {getStudent} from '@/features/students/student.repository';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {getSchoolTimezone} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function EditStudentPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireProfile(locale, 'ADMIN');
  const [student, groups, timeZone] = await Promise.all([
    getStudent(profile.schoolId, id),
    listGroups(profile.schoolId),
    getSchoolTimezone(profile.schoolId)
  ]);
  if (!student) notFound();
  const t = await getTranslations({locale, namespace: 'students'});
  const today = todayInTimeZone(timeZone);
  return <AdminPage title={t('editTitle')} description={t('description')}>
    <StudentForm groups={[]} locale={locale} student={student} today={today} />
    <StudentTransferForm groups={groups} locale={locale} student={student} today={today} />
  </AdminPage>;
}
