import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Alert} from '@/components/ui/alert';
import {PageHeader} from '@/components/ui/page-header';
import {AdministratorManagementList} from '@/features/administrators/administrator-management-list';
import {
  getAdministratorAccessStates,
  listAdministrators
} from '@/features/administrators/administrator.repository';
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

  return (
    <section className="admin-page">
      <PageHeader
        actions={<Link className="button button-primary action-link" href="/administrators/new">{t('addAdministrator')}</Link>}
        description={t('description')}
        title={t('title')}
      />

      {query.created === '1' ? <Alert variant="success">{t('created')}</Alert> : null}
      {query.deleted === '1' ? <Alert variant="success">{t('deleted')}</Alert> : null}
      {query.access === 'failed' ? <Alert variant="danger">{t('accessFailed')}</Alert> : null}
      {query.error === 'validation' ? <Alert variant="danger">{common('validation')}</Alert> : null}
      {query.error === 'save' ? <Alert variant="danger">{common('saveError')}</Alert> : null}
      {query.error === 'last-admin' ? <Alert variant="danger">{t('lastAdministrator')}</Alert> : null}

      <AdministratorManagementList
        accessStates={accessStates}
        administrators={administrators}
        locale={locale}
      />
    </section>
  );
}
