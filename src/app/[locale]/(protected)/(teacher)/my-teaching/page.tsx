import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AdminPage} from '@/components/ui/admin-page';
import {schoolWeekForDate} from '@/features/dashboard/dashboard.model';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {getSchoolTimezone,listMyTeaching} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireTeachingAccount} from '@/lib/auth/require-profile';

export default async function MyTeachingPage({params}:{params:Promise<{locale:string}>}){
  const{locale}=await params;
  if(!isLocale(locale))notFound();
  const{profile,teacherIds}=await requireTeachingAccount(locale);
  const timeZone=await getSchoolTimezone(profile.schoolId);
  const today=todayInTimeZone(timeZone);
  const weekStart=schoolWeekForDate(today).start;
  const contexts=await listMyTeaching(profile.schoolId,teacherIds,weekStart,weekStart);
  const t=await getTranslations({locale,namespace:'weekly'});
  const localName=(en:string,ar:string|null)=>locale==='ar'&&ar?ar:en;
  return <AdminPage title={t('myTeaching')} description={t('myTeachingDescription')}>
    {contexts.length===0?<p className="empty-state">{t('noTeaching')}</p>:<div className="group-cards">{contexts.map((context)=><article className="group-card" key={`${context.teacherId}:${context.classSubjectId}:${context.subjectGroupId??'whole'}`}>
      <h2>{localName(context.subjectNameEn,context.subjectNameAr)}</h2>
      <p><strong>{t('class')}:</strong> {localName(context.classNameEn,context.classNameAr)}</p>
      <p><strong>{t('group')}:</strong> {context.subjectGroupId?localName(context.groupNameEn??'',context.groupNameAr):t('wholeClass')}</p>
      <p>{t('studentCount',{count:context.studentCount})}</p>
      <p>{t(`submissionStatus.${context.status}`)}</p>
      <Link className="button button-primary action-link" href={`/my-teaching/update?teacherId=${context.teacherId}&classSubjectId=${context.classSubjectId}&subjectGroupId=${context.subjectGroupId??''}&week=${context.weekStart}`}>{t('updateThisWeek')}</Link>
    </article>)}</div>}
  </AdminPage>;
}
