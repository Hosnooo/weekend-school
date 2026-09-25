import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {ActionLink, AdminPage} from '@/components/ui/admin-page';
import {setClassActiveAction} from '@/features/classes/class.actions';
import {listClasses} from '@/features/classes/class.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function ClassesPage({params}: {params: Promise<{locale: string}>}) {
  const {locale}=await params;if(!isLocale(locale))notFound();
  const profile=await requireProfile(locale,'ADMIN');const classes=await listClasses(profile.schoolId);
  const [t,common]=await Promise.all([getTranslations({locale,namespace:'classes'}),getTranslations({locale,namespace:'common'})]);
  const archive=locale==='ar'?'أرشفة':'Archive';
  return <AdminPage title={t('title')} description={t('description')} actions={<ActionLink href="/classes/new">{t('addClass')}</ActionLink>}>
    {classes.length===0?<p className="empty-state">{t('empty')}</p>:<div className="table-wrap"><table><thead><tr><th>{t('name')}</th><th>{t('activeStudents')}</th><th>{t('subjects')}</th><th>{common('status')}</th><th>{common('actions')}</th></tr></thead><tbody>{classes.map((item)=><tr key={item.id}>
      <td><strong>{locale==='ar'&&item.nameAr?item.nameAr:item.nameEn}</strong></td><td>{item.activeStudentCount}</td><td>{item.subjectCount}</td>
      <td><span className={`status-badge ${item.isActive?'status-active':'status-inactive'}`}>{item.isActive?common('active'):common('inactive')}</span></td>
      <td><div className="row-actions"><Link href={`/classes/${item.id}`}>{t('openClass')}</Link><form action={setClassActiveAction}><input name="locale" type="hidden" value={locale}/><input name="classId" type="hidden" value={item.id}/><input name="isActive" type="hidden" value={String(!item.isActive)}/><button className="text-button">{item.isActive?archive:common('reactivate')}</button></form></div></td>
    </tr>)}</tbody></table></div>}
  </AdminPage>;
}
