import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {ActionLink, AdminPage} from '@/components/ui/admin-page';
import {resendTeacherAccessAction, setTeacherActiveAction} from '@/features/teachers/teacher.actions';
import {getTeacherAccessStates, listTeachers, listTeachingCandidates} from '@/features/teachers/teacher.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function TeachersPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{access?: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireProfile(locale, 'ADMIN');
  const [teachers, teachingCandidates] = await Promise.all([
    listTeachers(profile.schoolId),
    listTeachingCandidates(profile.schoolId)
  ]);
  const teacherIds = new Set(teachers.map((teacher) => teacher.id));
  const administratorCandidates = teachingCandidates.filter((candidate) => !teacherIds.has(candidate.id));
  const accessStates = await getTeacherAccessStates(teachers);
  const {access} = await searchParams;
  const [t, common, language] = await Promise.all([
    getTranslations({locale, namespace: 'teachers'}),
    getTranslations({locale, namespace: 'common'}),
    getTranslations({locale, namespace: 'language'})
  ]);

  return <AdminPage title={t('title')} description={t('description')} actions={<ActionLink href="/teachers/new">{t('addTeacher')}</ActionLink>}>
    {access === 'sent' ? <p role="status">{t('accessSent')}</p> : null}
    {access === 'failed' ? <p className="form-error" role="alert">{t('accessFailed')}</p> : null}
    {teachers.length === 0 ? <p className="empty-state">{t('empty')}</p> : <div className="table-wrap"><table>
      <thead><tr><th>{t('name')}</th><th>{t('assignments')}</th><th>{t('preferredLanguage')}</th><th>{t('accessState')}</th><th>{common('status')}</th><th>{common('actions')}</th></tr></thead>
      <tbody>{teachers.map((teacher) => <tr key={teacher.id}>
        <td><strong>{teacher.displayName}</strong></td>
        <td>{teacher.assignmentCount}</td>
        <td>{language(teacher.preferredLanguage === 'ar' ? 'arabic' : 'english')}</td>
        <td>{t(accessStates[teacher.id] ?? 'unknown')}</td>
        <td><span className={`status-badge ${teacher.isActive ? 'status-active' : 'status-inactive'}`}>{teacher.isActive ? common('active') : common('inactive')}</span></td>
        <td><div className="row-actions">
          <Link href={`/teachers/${teacher.id}/edit`}>{common('edit')}</Link>
          {teacher.isActive ? <form action={resendTeacherAccessAction}><input name="locale" type="hidden" value={locale}/><input name="id" type="hidden" value={teacher.id}/><button className="text-button">{t('resendAccess')}</button></form> : null}
          <form action={setTeacherActiveAction}><input name="locale" type="hidden" value={locale}/><input name="id" type="hidden" value={teacher.id}/><input name="isActive" type="hidden" value={String(!teacher.isActive)}/><button className="text-button">{teacher.isActive ? common('deactivate') : common('reactivate')}</button></form>
        </div></td>
      </tr>)}</tbody>
    </table></div>}

    {administratorCandidates.length > 0 ? <section className="subsection">
      <h2>{t('assignments')}</h2>
      <p>{t('description')}</p>
      <div className="table-wrap"><table>
        <thead><tr><th>{t('name')}</th><th>{common('actions')}</th></tr></thead>
        <tbody>{administratorCandidates.map((candidate) => <tr key={candidate.id}>
          <td><strong>{candidate.displayName}</strong></td>
          <td><Link href={`/teachers/${candidate.id}/assignments`}>{t('assignments')}</Link></td>
        </tr>)}</tbody>
      </table></div>
    </section> : null}
  </AdminPage>;
}
