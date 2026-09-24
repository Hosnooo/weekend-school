import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {AdminPage} from '@/components/ui/admin-page';
import {WeeklyUpdateForm} from '@/features/weekly-updates/weekly-update-form';
import {getWeeklySubmission} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {requireTeachingAccount} from '@/lib/auth/require-profile';
import {databaseUuid} from '@/lib/validation/fields';

export default async function WeeklyTeachingUpdatePage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{teacherId?:string;classSubjectId?:string;subjectGroupId?:string;week?:string}>}){
  const[{locale},query]=await Promise.all([params,searchParams]);
  if(!isLocale(locale))notFound();
  const teacher=databaseUuid.safeParse(query.teacherId);
  const classSubject=databaseUuid.safeParse(query.classSubjectId);
  const subjectGroup=query.subjectGroupId?databaseUuid.safeParse(query.subjectGroupId):{success:true as const,data:null};
  const week=z.iso.date().safeParse(query.week);
  if(!teacher.success||!classSubject.success||!subjectGroup.success||!week.success)notFound();
  const{profile,teacherIds}=await requireTeachingAccount(locale);
  if(!teacherIds.includes(teacher.data))notFound();
  const submission=await getWeeklySubmission(profile.schoolId,teacher.data,classSubject.data,subjectGroup.data,week.data);
  if(!submission)notFound();
  const t=await getTranslations({locale,namespace:'weekly'});
  const localName=(en:string,ar:string|null)=>locale==='ar'&&ar?ar:en;
  const contextName=[localName(submission.classNameEn,submission.classNameAr),localName(submission.subjectNameEn,submission.subjectNameAr),submission.subjectGroupId?localName(submission.groupNameEn??'',submission.groupNameAr):t('wholeClass')].join(' · ');
  const weekLabel=new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(new Date(`${submission.weekStart}T12:00:00Z`));
  return <AdminPage title={contextName} description={t('weekOf',{date:weekLabel})}>
    <WeeklyUpdateForm locale={locale} submission={submission} readOnly={submission.status==='SUBMITTED'}/>
  </AdminPage>;
}
