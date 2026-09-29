import {notFound} from 'next/navigation';

import {getDashboardSummary} from '@/features/dashboard/dashboard.repository';
import {selectDashboardWork} from '@/features/dashboard/dashboard.model';
import {DashboardWorkspace} from '@/features/dashboard/dashboard-workspace';
import {listClassReportCycles} from '@/features/reports/report-batch.repository';
import {listAdminTeachingUpdateRequestSets} from '@/features/teaching-updates/admin-teaching-update.repository';
import {getSchoolTimezone} from '@/features/weekly-updates/weekly-update.repository';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function DashboardPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);

  const [summary, requests, cycles, timeZone] = await Promise.all([
    getDashboardSummary(profile.schoolId),
    listAdminTeachingUpdateRequestSets(profile.schoolId),
    listClassReportCycles(profile.schoolId),
    getSchoolTimezone(profile.schoolId)
  ]);

  const work = selectDashboardWork(requests, cycles, todayInTimeZone(timeZone));

  return (
    <DashboardWorkspace
      cycles={cycles}
      locale={locale}
      requests={requests}
      summary={summary}
      work={work}
    />
  );
}
