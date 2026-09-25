import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Alert} from '@/components/ui/alert';
import {Button} from '@/components/ui/button';
import {PageHeader} from '@/components/ui/page-header';
import {createAdministratorAction} from '@/features/administrators/administrator.actions';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function NewAdministratorPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{error?: string}>;
}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  await requireAdministrator(locale);
  const [t, common] = await Promise.all([
    getTranslations({locale, namespace: 'administrators'}),
    getTranslations({locale, namespace: 'common'})
  ]);

  return (
    <section className="admin-page">
      <PageHeader
        actions={<Link className="button button-secondary action-link" href="/administrators">{t('title')}</Link>}
        description={t('newDescription')}
        title={t('addAdministrator')}
      />

      {query.error === 'validation' ? <Alert variant="danger">{common('validation')}</Alert> : null}
      {query.error === 'save' ? <Alert variant="danger">{common('saveError')}</Alert> : null}

      <form action={createAdministratorAction} className="record-form">
        <input name="locale" type="hidden" value={locale} />
        <div className="form-grid">
          <label>
            <span>{t('displayName')}</span>
            <input maxLength={120} name="displayName" required />
          </label>
          <label>
            <span>{t('email')}</span>
            <input autoComplete="email" name="email" required type="email" />
          </label>
        </div>
        <p className="muted-text">{t('addHelp')}</p>
        <div className="form-actions">
          <Button type="submit">{t('addAdministrator')}</Button>
          <Link className="button button-secondary action-link" href="/administrators">{common('cancel')}</Link>
        </div>
      </form>
    </section>
  );
}
