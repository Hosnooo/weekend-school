import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Badge} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';
import {PageHeader} from '@/components/ui/page-header';
import {SectionHeader} from '@/components/ui/section-header';
import {StatusBadge} from '@/components/ui/status-badge';
import {
  getAdministratorAccessStates,
  listAdministrators
} from '@/features/administrators/administrator.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function AdministratorDetailPage({params}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [administrators, t, common] = await Promise.all([
    listAdministrators(profile.schoolId),
    getTranslations({locale, namespace: 'administrators'}),
    getTranslations({locale, namespace: 'common'})
  ]);
  const administrator = administrators.find((item) => item.id === id);
  if (!administrator) notFound();
  const accessStates = await getAdministratorAccessStates([administrator]);
  const accessState = administrator.authUserId ? accessStates[administrator.id] ?? 'unknown' : null;

  return (
    <section className="admin-page">
      <PageHeader
        actions={(
          <>
            <Link className="button button-primary action-link" href={`/administrators/${administrator.id}/edit`}>
              {common('edit')}
            </Link>
            <Link className="button button-secondary action-link" href={`/administrators/${administrator.id}/access`}>
              {t('manageLoginAccess')}
            </Link>
          </>
        )}
        breadcrumbLabel={t('breadcrumbLabel')}
        breadcrumbs={[
          {label: t('title'), href: `/${locale}/administrators`},
          {label: administrator.displayName}
        ]}
        description={t('detailDescription')}
        title={administrator.displayName}
      />

      <div className="form-grid">
        <Card>
          <SectionHeader title={t('identityContact')} />
          <p><strong>{t('displayName')}:</strong> {administrator.displayName}</p>
          <p><strong>{t('email')}:</strong> {administrator.email ?? common('none')}</p>
        </Card>

        <Card>
          <SectionHeader title={t('loginAccess')} />
          <p>
            <Badge variant={administrator.authUserId ? 'info' : 'warning'}>
              {administrator.authUserId ? t('accountLinked') : t('noAccess')}
            </Badge>
          </p>
          <p>{accessState ? t(accessState) : t('accessUnlinkedHelp')}</p>
          <Link className="button button-secondary action-link" href={`/administrators/${administrator.id}/access`}>
            {t('manageLoginAccess')}
          </Link>
        </Card>

        <Card>
          <SectionHeader title={t('lifecycle')} />
          <p>
            <StatusBadge status={administrator.isActive ? 'active' : 'inactive'}>
              {administrator.isActive ? common('active') : common('inactive')}
            </StatusBadge>
          </p>
          <p>{administrator.isActive ? t('activeLifecycleHelp') : t('inactiveLifecycleHelp')}</p>
        </Card>
      </div>
    </section>
  );
}
