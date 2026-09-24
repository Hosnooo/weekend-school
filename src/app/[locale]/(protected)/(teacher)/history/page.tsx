import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AdminPage} from '@/components/ui/admin-page';
import {listTeacherHistory} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireTeachingProfile} from '@/lib/auth/require-profile';

export default async function HistoryPage({params}:{params:Promise<{locale:string}>}){
  const{locale}=await params;
  if(!isLocale(locale))notFound();
  const profile=await requireTeachingProfile(locale);
  const history=await listTeacherHistory(profile.schoolId,profile.id);
  const t=await getTranslations({locale,namespace:'weekly'});
  const common=await getTranslations({locale,namespace:'common'});
  const localName=(en:string,ar:string|null)=>locale==='ar'&&ar?ar:en;
  return <AdminPage title={t('history')} description={t('historyDescription')}>
    {history.length===0?<p className="empty-state">{t('noHistory')}</p>:<div className="table-wrap"><table><thead><tr><th>{t('class')}</th><th>{t('subject')}</th><th>{t('group')}</th><th>{t('week')}</th><th>{common('actions')}</th></tr></thead><tbody>{history.map((item)=><tr key={item.id}><td>{localName(item.classNameEn,item.classNameAr)}</td><td>{localName(item.subjectNameEn,item.subjectNameAr)}</td><td>{item.subjectGroupId?localName(item.groupNameEn??'',item.groupNameAr):t('wholeClass')}</td><td>{new Intl.DateTimeFormat(locale,{dateStyle:'long'}).format(new Date(`${item.weekStart}T12:00:00Z`))}</td><td><Link href={`/history/${item.id}`}>{t('view')}</Link></td></tr>)}</tbody></table></div>}
  </AdminPage>;
}
