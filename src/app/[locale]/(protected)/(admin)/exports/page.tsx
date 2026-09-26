import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {createExportAction} from '@/features/exports/export.actions';
import {ExportPanel, type ExportPanelLabels} from '@/features/exports/export-panel';
import {listExportOptions} from '@/features/exports/export.repository';
import {isLocale, type Locale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

const labels: Record<Locale, ExportPanelLabels & {pageTitle: string; pageDescription: string}> = {
  en: {
    pageTitle: 'Export Data', pageDescription: 'Create protected exports by period, scope, and dataset.',
    title: 'Export data', period: 'Period', thisWeek: 'This week', lastWeek: 'Last week', thisMonth: 'This month', lastMonth: 'Last month', custom: 'Custom', allHistory: 'All history',
    start: 'Start', end: 'End', scope: 'Scope', school: 'School', class: 'Class', subject: 'Subject', group: 'Group', student: 'Student', teacher: 'Teacher', datasets: 'Datasets', students: 'Students',
    memberships: 'Memberships', attendance: 'Attendance', comments: 'Comments', reports: 'Reports', deliveries: 'Deliveries', csv: 'CSV files', pdfs: 'Finalized report PDFs', fileOptions: 'File options', submit: 'Create export'
  },
  ar: {
    pageTitle: 'تصدير البيانات', pageDescription: 'أنشئ ملفات تصدير محمية حسب الفترة والنطاق ومجموعة البيانات.',
    title: 'تصدير البيانات', period: 'الفترة', thisWeek: 'هذا الأسبوع', lastWeek: 'الأسبوع الماضي', thisMonth: 'هذا الشهر', lastMonth: 'الشهر الماضي', custom: 'مخصص', allHistory: 'كل السجل',
    start: 'البداية', end: 'النهاية', scope: 'النطاق', school: 'المدرسة', class: 'الفصل', subject: 'المادة', group: 'المجموعة', student: 'الطالب', teacher: 'المعلم', datasets: 'مجموعات البيانات', students: 'الطلاب',
    memberships: 'العضويات', attendance: 'الحضور', comments: 'التعليقات', reports: 'التقارير', deliveries: 'عمليات الإرسال', csv: 'ملفات CSV', pdfs: 'ملفات PDF للتقارير النهائية', fileOptions: 'خيارات الملفات', submit: 'إنشاء التصدير'
  }
};

export default async function ExportsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale: rawLocale} = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const profile = await requireAdministrator(locale);
  const options = await listExportOptions(profile.schoolId, locale);
  const copy = labels[locale];
  return <AdminPage title={copy.pageTitle} description={copy.pageDescription}>
    <ExportPanel labels={copy} locale={locale} options={options} action={createExportAction}/>
  </AdminPage>;
}
