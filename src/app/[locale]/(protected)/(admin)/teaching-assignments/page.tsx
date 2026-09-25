import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {listTeachers} from '@/features/teachers/teacher.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function TeachingAssignmentsIndexPage({params}:{params:Promise<{locale:string}>}){
  const {locale}=await params;if(!isLocale(locale))notFound();
  const profile=await requireAdministrator(locale);const teachers=await listTeachers(profile.schoolId);
  const copy=locale==='ar'?{title:'تعيينات التدريس',description:'اعرض كل معلم وافتح تعييناته وتواريخها من مكان واحد.',teacher:'المعلم',current:'التعيينات الحالية',access:'الدخول',manage:'إدارة التعيينات',linked:'حساب مرتبط',none:'بدون حساب',empty:'لا توجد سجلات معلمين.'}:{title:'Teaching Assignments',description:'See every teacher and open their teaching contexts and dates from one place.',teacher:'Teacher',current:'Current teaching',access:'Login access',manage:'Manage assignments',linked:'Account linked',none:'No login',empty:'No Teacher records are available.'};
  return <AdminPage title={copy.title} description={copy.description}>{teachers.length===0?<p className="empty-state">{copy.empty}</p>:<div className="table-wrap"><table><thead><tr><th>{copy.teacher}</th><th>{copy.current}</th><th>{copy.access}</th><th></th></tr></thead><tbody>{teachers.map((teacher)=><tr key={teacher.id}><td><strong>{teacher.displayName}</strong></td><td>{teacher.assignmentCount}</td><td>{teacher.authUserId?copy.linked:copy.none}</td><td><Link className="button button-secondary action-link" href={`/teachers/${teacher.id}/assignments`}>{copy.manage}</Link></td></tr>)}</tbody></table></div>}</AdminPage>;
}
