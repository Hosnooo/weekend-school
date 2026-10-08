import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {
  ArchivePanel,
  type ArchivePanelLabels
} from '@/features/archives/archive-panel';
import {
  downloadArchivedStudentDataAction,
  permanentlyDeleteArchivedStudentAction,
  permanentlyDeleteManagedEntityAction,
  restoreArchivedStudentAction,
  restoreManagedEntityAction
} from '@/features/archives/archive.actions';
import {
  listArchivedStudents,
  listManagedArchivedRecords
} from '@/features/archives/archive.repository';
import {ManagedArchiveTable} from '@/features/archives/managed-archive-table';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

type PageLabels = ArchivePanelLabels & {
  pageTitle: string;
  pageDescription: string;
  otherTitle: string;
  otherEmpty: string;
  type: string;
  name: string;
  dependencies: string;
  status: string;
  actions: string;
  safe: string;
  blocked: string;
  destructive: string;
  delete: string;
  blockedReason: string;
  dependencyLabels: Record<string, string>;
};

export default async function ArchivesPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{error?: string; deleted?: string; restored?: string}>;
}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);

  if (!isLocale(locale)) notFound();

  const profile = await requireAdministrator(locale);

  const [students, managed, t] = await Promise.all([
    listArchivedStudents(profile.schoolId, locale),
    listManagedArchivedRecords(profile.schoolId),
    getTranslations({locale, namespace: 'archivesUi'})
  ]);

  const copy: PageLabels = {
    pageTitle: t('pageTitle'),
    pageDescription: t('pageDescription'),
    otherTitle: t('otherTitle'),
    otherEmpty: t('otherEmpty'),
    type: t('type'),
    name: t('name'),
    dependencies: t('dependencies'),
    status: t('status'),
    actions: t('actions'),
    safe: t('safe'),
    blocked: t('blocked'),
    destructive: t('destructive'),
    delete: t('permanentDelete'),
    blockedReason: t('blockedReason'),
    dependencyLabels: {
      accountLinks: t('dependency.accountLinks'),
      teachingAssignments: t('dependency.teachingAssignments'),
      groupAssignments: t('dependency.groupAssignments'),
      weeklySubmissions: t('dependency.weeklySubmissions'),
      studentLinks: t('dependency.studentLinks'),
      classSubjects: t('dependency.classSubjects'),
      enrollments: t('dependency.enrollments'),
      memberships: t('dependency.memberships'),
      groups: t('dependency.groups'),
      attendanceResolutions:
        t('dependency.attendanceResolutions'),
      reportBatches: t('dependency.reportBatches'),
      reports: t('dependency.reports'),
      emailDeliveries:
        t('dependency.emailDeliveries'),
      defaultUse: t('dependency.defaultUse')
    },
    title: t('archivedStudents'),
    empty: t('emptyStudents'),
    restore: t('restore'),
    viewHistory: t('viewHistory'),
    downloadData: t('downloadData'),
    downloadFirst: t('downloadFirst'),
    permanentDelete: t('permanentDelete'),
    deleteImpact: t('deleteImpact'),
    memberships: t('memberships'),
    attendanceObservations: t('attendanceObservations'),
    attendanceResolutions: t('attendanceResolutions'),
    comments: t('comments'),
    reports: t('reports'),
    emailDeliveries: t('emailDeliveries'),
    confirmation: t('confirmation'),
    downloadError: t('downloadError')
  };

  return (
    <AdminPage title={copy.pageTitle} description={copy.pageDescription}>
      {query.error === 'confirmation' ? (
        <p className="form-error" role="alert">
          {t('confirmationError')}
        </p>
      ) : null}

      {query.error === 'dependencies' ? (
        <p className="form-error" role="alert">
          {t('dependenciesError')}
        </p>
      ) : null}

      {query.error === 'delete' ? (
        <p className="form-error" role="alert">
          {t('deleteError')}
        </p>
      ) : null}

      {query.error === 'notArchived' ? (
        <p className="form-error" role="alert">{t('notArchivedError')}</p>
      ) : null}
      {query.error === 'permission' ? (
        <p className="form-error" role="alert">{t('permissionError')}</p>
      ) : null}
      {query.error === 'stale' ? (
        <p className="form-error" role="alert">{t('staleError')}</p>
      ) : null}
      {query.error === 'restore' ? (
        <p className="form-error" role="alert">{t('restoreError')}</p>
      ) : null}
      {query.restored === '1' ? (
        <p className="success-message" role="status">{t('restored')}</p>
      ) : null}

      {query.deleted === '1' ? (
        <p className="success-message" role="status">
          {t('deleted')}
        </p>
      ) : null}

      <ArchivePanel
        labels={copy}
        locale={locale}
        students={students}
        restoreAction={restoreArchivedStudentAction}
        downloadAction={downloadArchivedStudentDataAction}
        permanentDeleteAction={permanentlyDeleteArchivedStudentAction}
      />

      <ManagedArchiveTable
        labels={{
          sectionTitle: copy.otherTitle,
          empty: copy.otherEmpty,
          type: copy.type,
          name: copy.name,
          dependencies: copy.dependencies,
          status: copy.status,
          actions: copy.actions,
          safe: copy.safe,
          blocked: copy.blocked,
          destructive: copy.destructive,
          restore: copy.restore,
          permanentDelete: copy.delete,
          confirmation: copy.confirmation,
          blockedReason: copy.blockedReason,
          dependencyLabels: copy.dependencyLabels
        }}
        locale={locale}
        records={managed}
        restoreAction={restoreManagedEntityAction}
        permanentDeleteAction={permanentlyDeleteManagedEntityAction}
      />
    </AdminPage>
  );
}
