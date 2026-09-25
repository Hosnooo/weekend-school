import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage,SecondaryLink} from '@/components/ui/admin-page';
import {listTeachingAssignments,listTeachingClassSubjects} from '@/features/teaching-assignments/teaching-assignment.repository';
import {TeacherForm} from '@/features/teachers/teacher-form';
import {getTeacher} from '@/features/teachers/teacher.repository';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function EditTeacherPage({params}:{params:Promise<{locale:string;id:string}>}){
  const {locale,id}=await params;if(!isLocale(locale))notFound();
  const profile=await requireAdministrator(locale);
  const [teacher,classSubjects,assignments,t]=await Promise.all([getTeacher(profile.schoolId,id),listTeachingClassSubjects(profile.schoolId),listTeachingAssignments(profile.schoolId,id),getTranslations({locale,namespace:'teachers'})]);
  if(!teacher)notFound();
  const label=(en:string,ar:string|null)=>locale==='ar'&&ar?ar:en;
  const description=locale==='ar'?'عدّل سجل المعلم بشكل مستقل عن حساب الدخول وتعيينات التدريس.':'Edit the Teacher record independently from account access and teaching assignments.';
  return <AdminPage title={t('editTitle')} description={description} actions={<SecondaryLink href={`/teachers/${teacher.id}/assignments`}>{t('assignments')}</SecondaryLink>}>
    <TeacherForm locale={locale} teacher={teacher}/>
    <section className="subsection"><h2>{t('assignments')}</h2>{assignments.length===0?<p className="empty-state">{t('noAssignments')}</p>:<div className="table-wrap"><table><thead><tr><th>{t('class')}</th><th>{t('subject')}</th><th>{t('scope')}</th><th>{t('startsOn')}</th><th>{t('endsOn')}</th></tr></thead><tbody>{assignments.map((assignment)=>{const subject=classSubjects.find((item)=>item.id===assignment.classSubjectId);const group=subject?.groups.find((item)=>item.id===assignment.subjectGroupId)??null;return <tr key={assignment.id}><td>{subject?label(subject.classNameEn,subject.classNameAr):'—'}</td><td>{subject?label(subject.subjectNameEn,subject.subjectNameAr):'—'}</td><td>{assignment.subjectGroupId===null?t('entireSubject'):group?label(group.nameEn,group.nameAr):'—'}</td><td>{assignment.startsOn}</td><td>{assignment.endsOn??'—'}</td></tr>;})}</tbody></table></div>}<p><SecondaryLink href={`/teachers/${teacher.id}/assignments`}>{locale==='ar'?'إدارة تواريخ وتعيينات التدريس':'Manage teaching assignments and dates'}</SecondaryLink></p></section>
  </AdminPage>;
}
