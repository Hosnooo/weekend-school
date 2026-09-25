import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {ActionLink, AdminPage} from '@/components/ui/admin-page';
import {archiveManagedEntityAction} from '@/features/archives/archive.actions';
import {
  resendTeacherAccessAction,
  setTeacherActiveAction,
  unlinkTeacherAccessAction
} from '@/features/teachers/teacher.actions';
import {getTeacherAccessStates, listTeachers} from '@/features/teachers/teacher.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function TeachersPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{access?: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const teachers = await listTeachers(profile.schoolId);
  const accessStates = await getTeacherAccessStates(teachers);
  const {access} = await searchParams;
  const [t, common, language] = await Promise.all([
    getTranslations({locale, namespace: 'teachers'}),
    getTranslations({locale, namespace: 'common'}),
    getTranslations({locale, namespace: 'language'})
  ]);
  const addTeacher = locale === 'ar' ? 'إضافة معلم' : 'Add teacher';
  const description = locale === 'ar'
    ? 'أدر سجل المعلم، وصلاحية الدخول، وتغطية التدريس كأشياء مستقلة.'
    : 'Manage Teacher records, login access, and current teaching coverage as separate concepts.';
  const currentTeaching = locale === 'ar' ? 'التدريس الحالي' : 'Current teaching';
  const loginAccess = locale === 'ar' ? 'صلاحية الدخول' : 'Login access';
  const noLoginWarning = locale === 'ar'
    ? 'هذا المعلم لديه تعيين تدريس لكنه لا يملك حساب دخول مرتبطًا.'
    : 'This Teacher has teaching coverage but no linked login account.';
  const noAccess = locale === 'ar' ? 'لا يوجد حساب مرتبط' : 'No account linked';
  const unlinkAccess = locale === 'ar' ? 'إلغاء ربط الوصول' : 'Unlink access';
  const archive = locale === 'ar' ? 'أرشفة' : 'Archive';

  return <AdminPage title={t('title')} description={description} actions={<ActionLink href="/teachers/new">{addTeacher}</ActionLink>}>
    {access === 'sent' ? <p role="status">{t('accessSent')}</p> : null}
    {access === 'failed' ? <p className="form-error" role="alert">{t('accessFailed')}</p> : null}
    {teachers.length === 0 ? <p className="empty-state">{t('empty')}</p> : <div className="table-wrap"><table>
      <thead><tr><th>{t('name')}</th><th>{currentTeaching}</th><th>{t('preferredLanguage')}</th><th>{loginAccess}</th><th>{common('status')}</th><th>{common('actions')}</th></tr></thead>
      <tbody>{teachers.map((teacher) => <tr key={teacher.id}>
        <td><strong>{teacher.displayName}</strong>{teacher.assignmentCount>0&&!teacher.authUserId?<p className="form-error">{noLoginWarning}</p>:null}</td>
        <td>{teacher.assignmentCount}</td>
        <td>{language(teacher.preferredLanguage === 'ar' ? 'arabic' : 'english')}</td>
        <td>{teacher.authUserId ? t(accessStates[teacher.id] ?? 'unknown') : noAccess}</td>
        <td><span className={`status-badge ${teacher.isActive ? 'status-active' : 'status-inactive'}`}>{teacher.isActive ? common('active') : common('inactive')}</span></td>
        <td><div className="row-actions">
          <Link href={`/teachers/${teacher.id}/edit`}>{common('edit')}</Link>
          <Link href={`/teachers/${teacher.id}/assignments`}>{t('assignments')}</Link>
          {teacher.isActive && teacher.email ? <form action={resendTeacherAccessAction}><input name="locale" type="hidden" value={locale}/><input name="id" type="hidden" value={teacher.id}/><button className="text-button">{t('resendAccess')}</button></form> : null}
          {teacher.accountProfileId ? <form action={unlinkTeacherAccessAction}><input name="locale" type="hidden" value={locale}/><input name="teacherId" type="hidden" value={teacher.id}/><input name="profileId" type="hidden" value={teacher.accountProfileId}/><button className="text-button">{unlinkAccess}</button></form> : null}
          {teacher.isActive ? <form action={archiveManagedEntityAction}><input name="locale" type="hidden" value={locale}/><input name="entityType" type="hidden" value="TEACHER"/><input name="id" type="hidden" value={teacher.id}/><button className="text-button">{archive}</button></form> : <form action={setTeacherActiveAction}><input name="locale" type="hidden" value={locale}/><input name="id" type="hidden" value={teacher.id}/><input name="isActive" type="hidden" value="true"/><button className="text-button">{common('reactivate')}</button></form>}
        </div></td>
      </tr>)}</tbody>
    </table></div>}
  </AdminPage>;
}
