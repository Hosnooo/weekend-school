import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {ActionLink, AdminPage, SecondaryLink} from '@/components/ui/admin-page';
import {setGuardianActiveAction} from '@/features/guardians/guardian.actions';
import {listGuardians} from '@/features/guardians/guardian.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';
import {lifecycleErrorKey} from '@/lib/validation/lifecycle-feedback';

export default async function GuardiansPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{error?: string}>;
}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const profile = await requireProfile(locale,'ADMIN');
  const [guardians, t, common, navigation, languages] = await Promise.all([
    listGuardians(profile.schoolId),
    getTranslations({locale,namespace:'guardians'}),
    getTranslations({locale,namespace:'common'}),
    getTranslations({locale,namespace:'navigation'}),
    getTranslations({locale,namespace:'reportLanguages'})
  ]);
  return (
    <AdminPage
      title={t('title')}
      description={t('description')}
      actions={<>
        <SecondaryLink href="/students">{navigation('students')}</SecondaryLink>
        <ActionLink href="/students/guardians/new">{t('addGuardian')}</ActionLink>
      </>}
    >
      {query.error ? (
        <p className="form-error" role="alert">{common(lifecycleErrorKey(query.error))}</p>
      ) : null}
      {guardians.length === 0 ? <p className="empty-state">{t('empty')}</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('reportLanguage')}</th><th>{common('status')}</th><th>{common('actions')}</th></tr></thead>
            <tbody>
              {guardians.map((guardian) => (
                <tr key={guardian.id}>
                  <td>{guardian.name}</td>
                  <td><a href={`mailto:${guardian.email}`}>{guardian.email}</a></td>
                  <td>{languages(guardian.reportLanguage)}</td>
                  <td>
                    <span className={`status-badge ${guardian.isActive?'status-active':'status-inactive'}`}>
                      {guardian.isActive?common('active'):common('inactive')}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/students/guardians/${guardian.id}/edit`}>{common('edit')}</Link>
                      <form action={setGuardianActiveAction}>
                        <input name="locale" type="hidden" value={locale}/>
                        <input name="id" type="hidden" value={guardian.id}/>
                        <input name="isActive" type="hidden" value={String(!guardian.isActive)}/>
                        <button className="text-button" type="submit">
                          {guardian.isActive?common('deactivate'):common('reactivate')}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}
