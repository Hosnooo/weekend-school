import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {ArchivePanel, type ArchivePanelLabels} from '@/features/archives/archive-panel';
import {
  downloadArchivedStudentDataAction,
  permanentlyDeleteArchivedStudentAction,
  restoreArchivedStudentAction
} from '@/features/archives/archive.actions';
import {listArchivedStudents} from '@/features/archives/archive.repository';
import {createExportAction} from '@/features/exports/export.actions';
import {ExportPanel, type ExportPanelLabels} from '@/features/exports/export-panel';
import {listExportOptions} from '@/features/exports/export.repository';
import {isLocale, type Locale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

const archiveLabels: Record<Locale, ArchivePanelLabels & {pageTitle: string; pageDescription: string}> = {
  en: {
    pageTitle: 'Archives & export',
    pageDescription: 'Restore archived students, review deletion impact, and create protected data exports.',
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
    pageTitle: 'الأرشيف والتصدير',
    pageDescription: 'استعادة الطلاب المؤرشفين ومراجعة أثر الحذف وإنشاء ملفات تصدير محمية.',
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

const exportLabels: Record<Locale, ExportPanelLabels> = {
  en: {
    title: 'Export data', period: 'Period', thisWeek: 'This week', lastWeek: 'Last week',
    thisMonth: 'This month', lastMonth: 'Last month', custom: 'Custom', allHistory: 'All history',
    start: 'Start', end: 'End', scope: 'Scope', school: 'School', class: 'Class', subject: 'Subject',
    group: 'Group', student: 'Student', teacher: 'Teacher', datasets: 'Datasets', students: 'Students',
    memberships: 'Memberships', attendance: 'Attendance', comments: 'Comments', reports: 'Reports',
    deliveries: 'Deliveries', csv: 'CSV files', pdfs: 'Finalized report PDFs', submit: 'Create export'
  },
  ar: {
    title: 'تصدير البيانات', period: 'الفترة', thisWeek: 'هذا الأسبوع', lastWeek: 'الأسبوع الماضي',
    thisMonth: 'هذا الشهر', lastMonth: 'الشهر الماضي', custom: 'مخصص', allHistory: 'كل السجل',
    start: 'البداية', end: 'النهاية', scope: 'النطاق', school: 'المدرسة', class: 'الفصل', subject: 'المادة',
    group: 'المجموعة', student: 'الطالب', teacher: 'المعلم', datasets: 'مجموعات البيانات', students: 'الطلاب',
    memberships: 'العضويات', attendance: 'الحضور', comments: 'التعليقات', reports: 'التقارير',
    deliveries: 'عمليات الإرسال', csv: 'ملفات CSV', pdfs: 'ملفات PDF للتقارير النهائية', submit: 'إنشاء التصدير'
  }
};

export default async function ArchivesPage({params}: {params: Promise<{locale: string}>}) {
  const {locale: rawLocale} = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const profile = await requireAdministrator(locale);
  const [students, options] = await Promise.all([
    listArchivedStudents(profile.schoolId, locale),
    listExportOptions(profile.schoolId, locale)
  ]);
  const labels = archiveLabels[locale];

  return (
    <AdminPage title={labels.pageTitle} description={labels.pageDescription}>
      <ArchivePanel
        labels={labels}
        locale={locale}
        students={students}
        restoreAction={restoreArchivedStudentAction}
        downloadAction={downloadArchivedStudentDataAction}
        permanentDeleteAction={permanentlyDeleteArchivedStudentAction}
      />
      <ExportPanel labels={exportLabels[locale]} locale={locale} options={options} action={createExportAction}/>
    </AdminPage>
  );
}
