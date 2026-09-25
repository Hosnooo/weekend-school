import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {ActionLink, AdminPage} from '@/components/ui/admin-page';
import {setGuardianActiveAction} from '@/features/guardians/guardian.actions';
import {listGuardians} from '@/features/guardians/guardian.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function GuardiansPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireProfile(locale, 'ADMIN');
  const [guardians, t, common, languages] = await Promise.all([
    listGuardians(profile.schoolId),
    getTranslations({locale, namespace: 'guardians'}),
    getTranslations({locale, namespace: 'common'}),
    getTranslations({locale, namespace: 'reportLanguages'})
  ]);
  const addGuardian = locale === 'ar' ? 'إضافة ولي أمر' : 'Add guardian';
  return <AdminPage title={t('title')} description={t('description')} actions={<ActionLink href="/students/guardians/new">{addGuardian}</ActionLink>}>
    {guardians.length === 0 ? <p className="empty-state">{t('empty')}</p> : <div className="table-wrap"><table>
      <thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('reportLanguage')}</th><th>{common('status')}</th><th>{common('actions')}</th></tr></thead>
      <tbody>{guardians.map((guardian) => <tr key={guardian.id}>
        <td>{guardian.name}</td><td><a href={`mailto:${guardian.email}`}>{guardian.email}</a></td><td>{languages(guardian.reportLanguage)}</td>
        <td><span className={`status-badge ${guardian.isActive ? 'status-active' : 'status-inactive'}`}>{guardian.isActive ? common('active') : common('inactive')}</span></td>
        <td><div className="row-actions">
          <Link href={`/students/guardians/${guardian.id}/edit`}>{common('edit')}</Link>
          <form action={setGuardianActiveAction}><input name="locale" type="hidden" value={locale}/><input name="id" type="hidden" value={guardian.id}/><input name="isActive" type="hidden" value={String(!guardian.isActive)}/><button className="text-button">{guardian.isActive ? common('deactivate') : common('reactivate')}</button></form>
        </div></td>
      </tr>)}</tbody>
    </table></div>}
  </AdminPage>;
}
