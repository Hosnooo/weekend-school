import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {
  createAdministratorAction,
  deleteAdministratorAction,
  resendAdministratorAccessAction,
  setAdministratorActiveAction
} from '@/features/administrators/administrator.actions';
import {getAdministratorAccessStates, listAdministrators} from '@/features/administrators/administrator.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function AdministratorsPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{created?: string; deleted?: string; access?: string; error?: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [administrators, t, common, query] = await Promise.all([
    listAdministrators(profile.schoolId),
    getTranslations({locale, namespace: 'administrators'}),
    getTranslations({locale, namespace: 'common'}),
    searchParams
  ]);
  const accessStates = await getAdministratorAccessStates(administrators);
  const description = locale === 'ar'
    ? 'أدر سجلات المسؤولين وصلاحية الدخول بشكل مستقل عن صلاحية المعلم.'
    : 'Manage Administrator records and account access independently from Teacher capability.';

  return <AdminPage title={t('title')} description={description}>
    {query.created === '1' ? <p role="status">{t('created')}</p> : null}
    {query.deleted === '1' ? <p role="status">{t('deleted')}</p> : null}
    {query.access === 'sent' ? <p role="status">{t('accessSent')}</p> : null}
    {query.access === 'failed' ? <p className="form-error" role="alert">{t('accessFailed')}</p> : null}
    {query.error === 'validation' ? <p className="form-error" role="alert">{common('validation')}</p> : null}
    {query.error === 'save' ? <p className="form-error" role="alert">{common('saveError')}</p> : null}
    {query.error === 'last-admin' ? <p className="form-error" role="alert">{t('lastAdministrator')}</p> : null}

    <section className="record-card">
      <h2>{t('addAdministrator')}</h2>
      <p>{t('addHelp')}</p>
      <form action={createAdministratorAction} className="form-grid">
        <input name="locale" type="hidden" value={locale}/>
        <label><span>{t('displayName')}</span><input name="displayName" required maxLength={120}/></label>
        <label><span>{t('email')}</span><input name="email" type="email" required autoComplete="email"/></label>
        <div className="form-actions"><button className="button button-primary" type="submit">{t('addAdministrator')}</button></div>
      </form>
    </section>

    {administrators.length === 0 ? <p className="empty-state">{t('empty')}</p> : <div className="table-wrap"><table>
      <thead><tr><th>{t('displayName')}</th><th>{t('email')}</th><th>{t('accessState')}</th><th>{common('status')}</th><th>{common('actions')}</th></tr></thead>
      <tbody>{administrators.map((administrator) => <tr key={administrator.id}>
        <td><strong>{administrator.displayName}</strong></td>
        <td>{administrator.email ?? common('none')}</td>
        <td>{administrator.authUserId ? t(accessStates[administrator.id] ?? 'unknown') : t('noAccess')}</td>
        <td><span className={`status-badge ${administrator.isActive ? 'status-active' : 'status-inactive'}`}>{administrator.isActive ? common('active') : common('inactive')}</span></td>
        <td><div className="row-actions">
          <Link href={`/administrators/${administrator.id}/edit`}>{common('edit')}</Link>
          {administrator.email ? <form action={resendAdministratorAccessAction}>
            <input name="locale" type="hidden" value={locale}/><input name="administratorId" type="hidden" value={administrator.id}/>
            <button className="text-button">{administrator.authUserId ? t('resendAccess') : t('sendAccess')}</button>
          </form> : null}
          {administrator.isActive || administrator.accountProfileId ? <form action={setAdministratorActiveAction}>
            <input name="locale" type="hidden" value={locale}/><input name="administratorId" type="hidden" value={administrator.id}/><input name="isActive" type="hidden" value={String(!administrator.isActive)}/>
            <button className="text-button">{administrator.isActive ? common('deactivate') : common('reactivate')}</button>
          </form> : null}
          {!administrator.isActive ? <form action={deleteAdministratorAction}>
            <input name="locale" type="hidden" value={locale}/><input name="administratorId" type="hidden" value={administrator.id}/>
            <button className="text-button">{t('delete')}</button>
          </form> : null}
        </div></td>
      </tr>)}</tbody>
    </table></div>}
  </AdminPage>;
}
