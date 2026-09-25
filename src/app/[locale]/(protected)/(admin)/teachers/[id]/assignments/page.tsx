import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage,SecondaryLink} from '@/components/ui/admin-page';
import {TeachingAssignmentWorkspace} from '@/features/teaching-assignments/teaching-assignment-workspace';
import {listTeachingAssignments,listTeachingClassSubjects} from '@/features/teaching-assignments/teaching-assignment.repository';
import {listTeachingCandidates} from '@/features/teachers/teacher.repository';
import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {getSchoolTimezone} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function TeachingAssignmentsPage({params,searchParams}:{params:Promise<{locale:string;id:string}>;searchParams:Promise<{error?:string}>}){
  const [{locale,id},query]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();
  const profile=await requireAdministrator(locale);
  const [candidates,classSubjects,assignments,timeZone,t]=await Promise.all([listTeachingCandidates(profile.schoolId),listTeachingClassSubjects(profile.schoolId),listTeachingAssignments(profile.schoolId,id),getSchoolTimezone(profile.schoolId),getTranslations({locale,namespace:'teachers'})]);
  const candidate=candidates.find((item)=>item.id===id);if(!candidate)notFound();const today=todayInTimeZone(timeZone);
  const warning=locale==='ar'?'لا يمكن تطبيق هذا التغيير لأنه يتعارض مع تعيين آخر أو سيجعل سجل تدريس مُسلَّم بلا تغطية صالحة.':'That date change cannot be applied because it conflicts with another assignment or would invalidate protected submitted teaching history.';
  return <AdminPage title={`${candidate.displayName} — ${t('assignments')}`} description={t('assignmentHelp')} actions={<SecondaryLink href="/teaching-assignments">{locale==='ar'?'كل التعيينات':'All assignments'}</SecondaryLink>}>
    {query.error==='protected-history'?<p className="form-error" role="alert">{warning}</p>:null}
    <TeachingAssignmentWorkspace assignments={assignments} classSubjects={classSubjects} locale={locale} teacherId={candidate.id} today={today}/>
  </AdminPage>;
}
