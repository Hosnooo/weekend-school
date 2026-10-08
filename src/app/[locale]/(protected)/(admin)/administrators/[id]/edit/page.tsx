import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Alert} from '@/components/ui/alert';
import {PageHeader} from '@/components/ui/page-header';
import {listAdministrators} from '@/features/administrators/administrator.repository';
import {updateAdministratorDetailsAction} from '@/features/administrators/administrator-edit.actions';
import {AdministratorDetailsForm} from '@/features/administrators/administrator-details-form';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function EditAdministratorPage({params, searchParams}: {
  params: Promise<{locale: string; id: string}>;
  searchParams: Promise<{error?: string}>;
}) {
  const [{locale, id}, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [administrators, t, common] = await Promise.all([
    listAdministrators(profile.schoolId),
    getTranslations({locale, namespace: 'administrators'}),
    getTranslations({locale, namespace: 'common'})
  ]);
  const administrator = administrators.find((item) => item.id === id);
  if (!administrator) notFound();

  return (
    <section className="admin-page">
      <PageHeader
        actions={<Link className="button button-secondary action-link" href={`/administrators/${administrator.id}`}>{t('backToAdministrator')}</Link>}
        description={t('editDescription')}
        title={t('editTitle')}
      />

      {query.error === 'validation' ? <Alert variant="danger">{common('validation')}</Alert> : null}
      {query.error === 'save' ? <Alert variant="danger">{common('saveError')}</Alert> : null}

      <AdministratorDetailsForm
        action={updateAdministratorDetailsAction}
        locale={locale}
        id={administrator.id}
        displayName={administrator.displayName}
        email={administrator.email ?? ''}
        labels={{
          displayName: t('displayName'),
          email: t('email'),
          addHelp: t('addHelp'),
          emailAccessHelp: t('emailAccessHelp'),
          submit: common('save'),
          cancel: common('cancel')
        }}
        cancelHref={`/administrators/${administrator.id}`}
      />
    </section>
  );
}
