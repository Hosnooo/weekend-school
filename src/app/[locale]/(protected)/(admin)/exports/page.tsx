import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {createExportAction} from '@/features/exports/export.actions';
import {
  ExportPanel,
  type ExportPanelLabels
} from '@/features/exports/export-panel';
import {listExportOptions} from '@/features/exports/export.repository';
import {RosterExportPanel} from '@/features/roster-csv/roster-export-panel';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function ExportsPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireAdministrator(locale);

  const [options, t] = await Promise.all([
    listExportOptions(profile.schoolId, locale),
    getTranslations({locale, namespace: 'exportsUi'})
  ]);

  const copy: ExportPanelLabels & {
    pageTitle: string;
    pageDescription: string;
  } = {
    pageTitle: t('pageTitle'),
    pageDescription: t('pageDescription'),
    title: t('title'),
    period: t('period'),
    thisWeek: t('thisWeek'),
    lastWeek: t('lastWeek'),
    thisMonth: t('thisMonth'),
    lastMonth: t('lastMonth'),
    custom: t('custom'),
    allHistory: t('allHistory'),
    start: t('start'),
    end: t('end'),
    scope: t('scope'),
    school: t('school'),
    class: t('class'),
    subject: t('subject'),
    group: t('group'),
    student: t('student'),
    teacher: t('teacher'),
    datasets: t('datasets'),
    students: t('students'),
    memberships: t('memberships'),
    attendance: t('attendance'),
    comments: t('comments'),
    reports: t('reports'),
    deliveries: t('deliveries'),
    csv: t('csv'),
    pdfs: t('pdfs'),
    fileOptions: t('fileOptions'),
    submit: t('submit'),
    errors: {
      period: t('errorPeriod'),
      datasets: t('errorDatasets'),
      scope: t('errorScope'),
      generic: t('errorDownload'),
      expired: t('errorExpired'),
      access: t('errorAccess')
    }
  };

  return (
    <AdminPage title={copy.pageTitle} description={copy.pageDescription}>
      <ExportPanel
        labels={copy}
        locale={locale}
        options={options}
        action={createExportAction}
      />

      <RosterExportPanel
        classes={options.classes}
        labels={{
          title: t('rosterTitle'),
          description: t('rosterDescription'),
          schoolRoster: t('rosterSchool'),
          classRosters: t('rosterClasses'),
          downloadSchool: t('downloadSchoolRoster'),
          downloadClass: t('downloadClassRoster'),
          errors: {
            expired: t('errorExpired'),
            access: t('errorAccess'),
            unavailable: t('errorDownload')
          }
        }}
        locale={locale}
      />
    </AdminPage>
  );
}
