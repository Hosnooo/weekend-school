import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {listTeachers} from '@/features/teachers/teacher.repository';
import {isLocale} from '@/i18n/config';
import {requireTeachingAccount} from '@/lib/auth/require-profile';

export default async function TeacherProfilePage({params}:{params:Promise<{locale:string}>}){
  const {locale}=await params;
  if(!isLocale(locale))notFound();
  const {profile,teacherIds}=await requireTeachingAccount(locale);
  const teacherRecords=(await listTeachers(profile.schoolId)).filter((teacher)=>teacherIds.includes(teacher.id));
  const copy=locale==='ar'
    ?{title:'ملفي الشخصي',description:'هوية الدخول وسجلات المعلم المرتبطة بهذا الحساب.',identity:'هوية الدخول',teacherRecords:'سجلات المعلم',language:'اللغة المفضلة',active:'نشط',none:'لا يوجد سجل معلم مرتبط.'}
    :{title:'My Profile',description:'Your login identity and the Teacher records linked to this account.',identity:'Login identity',teacherRecords:'Teacher records',language:'Preferred language',active:'Active',none:'No linked Teacher record is available.'};
  return <AdminPage title={copy.title} description={copy.description}>
    <section className="subsection"><h2>{copy.identity}</h2><p><strong>{profile.displayName}</strong></p><p>{copy.language}: {profile.preferredLanguage==='ar'?'العربية':'English'}</p></section>
    <section className="subsection"><h2>{copy.teacherRecords}</h2>{teacherRecords.length===0?<p className="empty-state">{copy.none}</p>:<div className="record-list">{teacherRecords.map((teacher)=><article className="record-card" key={teacher.id}><strong>{teacher.displayName}</strong><p>{teacher.email??'—'}</p><span className={`status-badge ${teacher.isActive?'status-active':'status-inactive'}`}>{teacher.isActive?copy.active:'Inactive'}</span></article>)}</div>}</section>
  </AdminPage>;
}
