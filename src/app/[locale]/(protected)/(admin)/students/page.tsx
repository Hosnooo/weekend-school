import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {ActionLink, AdminPage, SecondaryLink} from '@/components/ui/admin-page';
import {setStudentActiveAction} from '@/features/students/student.actions';
import {listStudents} from '@/features/students/student.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function StudentsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale}=await params; if(!isLocale(locale)) notFound();
  const profile=await requireProfile(locale,'ADMIN'); const students=await listStudents(profile.schoolId);
  const t=await getTranslations({locale,namespace:'students'}); const common=await getTranslations({locale,namespace:'common'});
  return <AdminPage title={t('title')} description={t('description')} actions={<><SecondaryLink href="/students/guardians">{t('manageGuardians')}</SecondaryLink><ActionLink href="/students/new">{t('addStudent')}</ActionLink></>}>
    {students.length===0?<p className="empty-state">{t('empty')}</p>:<div className="table-wrap"><table><thead><tr><th>{t('name')}</th><th>{t('group')}</th><th>{common('status')}</th><th>{common('actions')}</th></tr></thead><tbody>{students.map((student)=><tr key={student.id}><td><strong>{locale==='ar'&&student.firstNameAr&&student.lastNameAr?`${student.firstNameAr} ${student.lastNameAr}`:`${student.firstNameEn} ${student.lastNameEn}`}</strong></td><td>{student.currentGroup?(locale==='ar'&&student.currentGroup.nameAr?student.currentGroup.nameAr:student.currentGroup.nameEn):common('notAssigned')}</td><td><span className={`status-badge ${student.isActive?'status-active':'status-inactive'}`}>{student.isActive?common('active'):common('inactive')}</span></td><td><div className="row-actions"><Link href={`/students/${student.id}/edit`}>{common('edit')}</Link><form action={setStudentActiveAction}><input name="locale" type="hidden" value={locale}/><input name="id" type="hidden" value={student.id}/><input name="isActive" type="hidden" value={String(!student.isActive)}/><button className="text-button" type="submit">{student.isActive?common('deactivate'):common('reactivate')}</button></form></div></td></tr>)}</tbody></table></div>}
  </AdminPage>;
}
