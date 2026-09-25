import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage, SecondaryLink} from '@/components/ui/admin-page';
import {updateAdministratorDetailsAction} from '@/features/administrators/administrator-edit.actions';
import {listAdministrators} from '@/features/administrators/administrator.repository';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function EditAdministratorPage({params, searchParams}: {
  params: Promise<{locale: string; id: string}>;
  searchParams: Promise<{error?: string}>;
}) {
  const [{locale, id}, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const administrator = (await listAdministrators(profile.schoolId)).find((item) => item.id === id);
  if (!administrator) notFound();
  const [t, common] = await Promise.all([
    getTranslations({locale, namespace: 'administrators'}),
    getTranslations({locale, namespace: 'common'})
  ]);
  const copy = locale === 'ar'
    ? {title: 'تعديل المسؤول', description: 'عدّل سجل المسؤول دون تغيير هوية حساب الدخول أو صلاحية المعلم.', account: 'بريد حساب الوصول', save: 'حفظ التفاصيل'}
    : {title: 'Edit Administrator', description: 'Edit the Administrator record without changing login identity or Teacher capability.', account: 'Access email', save: 'Save details'};

  return <AdminPage title={copy.title} description={copy.description} actions={<SecondaryLink href="/administrators">{t('title')}</SecondaryLink>}>
    {query.error === 'validation' ? <p className="form-error" role="alert">{common('validation')}</p> : null}
    {query.error === 'save' ? <p className="form-error" role="alert">{common('saveError')}</p> : null}
    <form action={updateAdministratorDetailsAction} className="record-form">
      <input name="locale" type="hidden" value={locale}/>
      <input name="id" type="hidden" value={administrator.id}/>
      <div className="form-grid">
        <label>{t('displayName')}<input defaultValue={administrator.displayName} maxLength={120} name="displayName" required/></label>
        <label>{copy.account}<input disabled value={administrator.email ?? common('none')}/></label>
      </div>
      <p className="muted-text">{copy.description}</p>
      <div className="form-actions"><button className="button button-primary" type="submit">{copy.save}</button></div>
    </form>
  </AdminPage>;
}
