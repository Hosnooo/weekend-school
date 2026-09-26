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
import {isLocale, type Locale} from '@/i18n/config';
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
  delete: string;
  blockedReason: string;
  dependencyLabels: Record<string, string>;
};

const labels: Record<Locale, PageLabels> = {
  en: {
    pageTitle: 'Archives',
    pageDescription:
      'Restore inactive records or permanently delete only records with no protected dependencies.',

    otherTitle: 'Other archived records',
    otherEmpty: 'No other archived records.',
    type: 'Type',
    name: 'Name',
    dependencies: 'Protected dependencies',
    status: 'Status',
    actions: 'Actions',
    safe: 'Safe to delete',
    blocked: 'Deletion blocked',
    delete: 'Permanently delete',
    blockedReason:
      'Permanent deletion is blocked by protected dependencies.',

    dependencyLabels: {
      accountLinks: 'Account links',
      teachingAssignments: 'Teaching assignments',
      groupAssignments: 'Group assignments',
      weeklySubmissions: 'Weekly submissions',
      studentLinks: 'Student links',
      classSubjects: 'Class subjects',
      enrollments: 'Enrollments',
      memberships: 'Memberships',
      defaultUse: 'Default group use'
    },

    title: 'Archived students',
    empty: 'No archived students',
    restore: 'Restore',
    viewHistory: 'View data/history',
    downloadData: 'Download data',
    downloadFirst: 'Download data first',
    permanentDelete: 'Permanently delete',
    deleteImpact: 'Deletion impact',
    memberships: 'Memberships',
    attendanceObservations: 'Attendance observations',
    attendanceResolutions: 'Attendance resolutions',
    comments: 'Comments',
    reports: 'Reports',
    emailDeliveries: 'Email deliveries',
    confirmation: 'Confirmation'
  },

  ar: {
    pageTitle: 'الأرشيف',
    pageDescription:
      'استعد السجلات غير النشطة أو احذف نهائيًا فقط السجلات التي لا ترتبط ببيانات محمية.',

    otherTitle: 'سجلات مؤرشفة أخرى',
    otherEmpty: 'لا توجد سجلات مؤرشفة أخرى.',
    type: 'النوع',
    name: 'الاسم',
    dependencies: 'الارتباطات المحمية',
    status: 'الحالة',
    actions: 'الإجراءات',
    safe: 'آمن للحذف',
    blocked: 'الحذف محظور',
    delete: 'حذف نهائي',
    blockedReason: 'الحذف النهائي محظور بسبب وجود ارتباطات محمية.',

    dependencyLabels: {
      accountLinks: 'ارتباطات الحساب',
      teachingAssignments: 'تكليفات التدريس',
      groupAssignments: 'تكليفات المجموعات',
      weeklySubmissions: 'التحديثات الأسبوعية',
      studentLinks: 'ارتباطات الطلاب',
      classSubjects: 'مواد الفصل',
      enrollments: 'التسجيلات',
      memberships: 'العضويات',
      defaultUse: 'الاستخدام كمجموعة افتراضية'
    },

    title: 'الطلاب المؤرشفون',
    empty: 'لا يوجد طلاب مؤرشفون',
    restore: 'استعادة',
    viewHistory: 'عرض البيانات والسجل',
    downloadData: 'تنزيل البيانات',
    downloadFirst: 'نزّل البيانات أولاً',
    permanentDelete: 'حذف نهائي',
    deleteImpact: 'أثر الحذف',
    memberships: 'العضويات',
    attendanceObservations: 'سجلات الحضور',
    attendanceResolutions: 'تسويات الحضور',
    comments: 'التعليقات',
    reports: 'التقارير',
    emailDeliveries: 'عمليات إرسال البريد',
    confirmation: 'التأكيد'
  }
};

export default async function ArchivesPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{error?: string; deleted?: string}>;
}) {
  const [{locale: rawLocale}, query] = await Promise.all([
    params,
    searchParams
  ]);

  if (!isLocale(rawLocale)) notFound();

  const locale = rawLocale;
  const profile = await requireAdministrator(locale);

  const [students, managed] = await Promise.all([
    listArchivedStudents(profile.schoolId, locale),
    listManagedArchivedRecords(profile.schoolId)
  ]);

  const copy = labels[locale];

  return (
    <AdminPage
      title={copy.pageTitle}
      description={copy.pageDescription}
    >
      {query.error === 'confirmation' ? (
        <p className="form-error" role="alert">
          {locale === 'ar'
            ? 'اكتب عبارة التأكيد كاملة كما هي.'
            : 'Enter the exact deletion confirmation.'}
        </p>
      ) : null}

      {query.error === 'dependencies' ? (
        <p className="form-error" role="alert">
          {locale === 'ar'
            ? 'لا يمكن الحذف بسبب وجود بيانات أو ارتباطات محمية.'
            : 'Permanent deletion is blocked by protected dependencies.'}
        </p>
      ) : null}

      {query.deleted === '1' ? (
        <p className="success-message" role="status">
          {locale === 'ar'
            ? 'تم حذف السجل نهائيًا.'
            : 'Archived record permanently deleted.'}
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
