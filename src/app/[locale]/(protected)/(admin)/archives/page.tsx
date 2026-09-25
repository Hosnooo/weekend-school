import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {ArchivePanel, type ArchivePanelLabels} from '@/features/archives/archive-panel';
import {
  downloadArchivedStudentDataAction,
  permanentlyDeleteArchivedStudentAction,
  permanentlyDeleteManagedEntityAction,
  restoreArchivedStudentAction,
  restoreManagedEntityAction
} from '@/features/archives/archive.actions';
import {listArchivedStudents, listManagedArchivedRecords} from '@/features/archives/archive.repository';
import {isLocale, type Locale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

const labels: Record<Locale, ArchivePanelLabels & {pageTitle:string;pageDescription:string;otherTitle:string;type:string;dependencies:string;safe:string;blocked:string;delete:string}> = {
  en: {
    pageTitle:'Archives', pageDescription:'Restore inactive records or permanently delete only records with no protected dependencies.', otherTitle:'Other archived records', type:'Type', dependencies:'Protected dependencies', safe:'Safe to delete', blocked:'Deletion blocked', delete:'Permanently delete',
    title:'Archived students', empty:'No archived students', restore:'Restore', viewHistory:'View data/history', downloadData:'Download data', downloadFirst:'Download data first', permanentDelete:'Permanently delete', deleteImpact:'Deletion impact', memberships:'Memberships', attendanceObservations:'Attendance observations', attendanceResolutions:'Attendance resolutions', comments:'Comments', reports:'Reports', emailDeliveries:'Email deliveries', confirmation:'Confirmation'
  },
  ar: {
    pageTitle:'الأرشيف', pageDescription:'استعد السجلات غير النشطة أو احذف نهائيًا فقط السجلات التي لا ترتبط ببيانات محمية.', otherTitle:'سجلات مؤرشفة أخرى', type:'النوع', dependencies:'الارتباطات المحمية', safe:'آمن للحذف', blocked:'الحذف محظور', delete:'حذف نهائي',
    title:'الطلاب المؤرشفون', empty:'لا يوجد طلاب مؤرشفون', restore:'استعادة', viewHistory:'عرض البيانات والسجل', downloadData:'تنزيل البيانات', downloadFirst:'نزّل البيانات أولاً', permanentDelete:'حذف نهائي', deleteImpact:'أثر الحذف', memberships:'العضويات', attendanceObservations:'سجلات الحضور', attendanceResolutions:'تسويات الحضور', comments:'التعليقات', reports:'التقارير', emailDeliveries:'عمليات إرسال البريد', confirmation:'التأكيد'
  }
};

export default async function ArchivesPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{error?:string;deleted?:string}>}) {
  const [{locale:rawLocale},query]=await Promise.all([params,searchParams]);
  if(!isLocale(rawLocale))notFound();
  const locale=rawLocale;
  const profile=await requireAdministrator(locale);
  const [students,managed]=await Promise.all([listArchivedStudents(profile.schoolId,locale),listManagedArchivedRecords(profile.schoolId)]);
  const copy=labels[locale];
  return <AdminPage title={copy.pageTitle} description={copy.pageDescription}>
    {query.error==='confirmation'?<p className="form-error" role="alert">{locale==='ar'?'اكتب عبارة التأكيد كاملة كما هي.':'Enter the exact deletion confirmation.'}</p>:null}
    {query.error==='dependencies'?<p className="form-error" role="alert">{locale==='ar'?'لا يمكن الحذف بسبب وجود بيانات أو ارتباطات محمية.':'Permanent deletion is blocked by protected dependencies.'}</p>:null}
    {query.deleted==='1'?<p className="success-message" role="status">{locale==='ar'?'تم حذف السجل نهائيًا.':'Archived record permanently deleted.'}</p>:null}
    <ArchivePanel labels={copy} locale={locale} students={students} restoreAction={restoreArchivedStudentAction} downloadAction={downloadArchivedStudentDataAction} permanentDeleteAction={permanentlyDeleteArchivedStudentAction}/>
    <section className="subsection"><h2>{copy.otherTitle}</h2>
      {managed.length===0?<p className="empty-state">{locale==='ar'?'لا توجد سجلات أخرى مؤرشفة.':'No other archived records.'}</p>:<div className="table-wrap"><table>
        <thead><tr><th>{copy.type}</th><th>{locale==='ar'?'الاسم':'Name'}</th><th>{copy.dependencies}</th><th>{locale==='ar'?'الحالة':'Status'}</th><th>{locale==='ar'?'الإجراءات':'Actions'}</th></tr></thead>
        <tbody>{managed.map((record)=><tr key={`${record.entityType}:${record.id}`}>
          <td>{record.entityType}</td><td><strong>{record.name}</strong></td><td>{record.impact.dependencyCount}</td><td><span className={`status-badge ${record.impact.canPermanentlyDelete?'status-active':'status-inactive'}`}>{record.impact.canPermanentlyDelete?copy.safe:copy.blocked}</span></td>
          <td><div className="row-actions">
            <form action={restoreManagedEntityAction}><input name="locale" type="hidden" value={locale}/><input name="entityType" type="hidden" value={record.entityType}/><input name="id" type="hidden" value={record.id}/><button className="button button-secondary">{copy.restore}</button></form>
            {record.impact.canPermanentlyDelete?<form action={permanentlyDeleteManagedEntityAction} className="inline-delete-form"><input name="locale" type="hidden" value={locale}/><input name="entityType" type="hidden" value={record.entityType}/><input name="id" type="hidden" value={record.id}/><input aria-label={copy.confirmation} name="confirmation" placeholder={`DELETE ${record.id}`} required/><button className="button button-danger">{copy.delete}</button></form>:null}
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </AdminPage>;
}
