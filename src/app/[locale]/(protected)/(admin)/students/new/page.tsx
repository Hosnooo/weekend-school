import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {listEnrollmentClasses} from '@/features/enrollment/enrollment.repository';
import {listGuardians} from '@/features/guardians/guardian.repository';
import {StudentForm} from '@/features/students/student-form';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {getSchoolTimezone} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function NewStudentPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireProfile(locale, 'ADMIN');
  const [classes, timeZone, availableGuardians, t] = await Promise.all([
    listEnrollmentClasses(profile.schoolId),
    getSchoolTimezone(profile.schoolId),
    listGuardians(profile.schoolId),
    getTranslations({locale, namespace: 'students'})
  ]);

  return <AdminPage title={t('newTitle')} description={t('description')}>
    <StudentForm
      availableGuardians={availableGuardians}
      classes={classes}
      locale={locale}
      today={todayInTimeZone(timeZone)}
    />
  </AdminPage>;
}
