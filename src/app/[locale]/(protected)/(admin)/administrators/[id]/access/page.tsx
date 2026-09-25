import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Alert} from '@/components/ui/alert';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {PageHeader} from '@/components/ui/page-header';
import {SectionHeader} from '@/components/ui/section-header';
import {resendAdministratorAccessAction} from '@/features/administrators/administrator.actions';
import {
  getAdministratorAccessStates,
  listAdministrators
} from '@/features/administrators/administrator.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function AdministratorAccessPage({params, searchParams}: {
  params: Promise<{locale: string; id: string}>;
  searchParams: Promise<{access?: string}>;
}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [administrators, t, common, query] = await Promise.all([
    listAdministrators(profile.schoolId),
    getTranslations({locale, namespace: 'administrators'}),
    getTranslations({locale, namespace: 'common'}),
    searchParams
  ]);
  const administrator = administrators.find((item) => item.id === id);
  if (!administrator) notFound();
  const accessStates = await getAdministratorAccessStates([administrator]);
  const accessState = administrator.authUserId ? accessStates[administrator.id] ?? 'unknown' : null;

  return (
    <section className="admin-page">
      <PageHeader
        actions={(
          <Link className="button button-secondary action-link" href={`/administrators/${administrator.id}`}>
            {t('backToAdministrator')}
          </Link>
        )}
        description={t('accessDescription')}
        title={`${administrator.displayName} — ${t('loginAccess')}`}
      />

      {query.access === 'sent' ? <Alert variant="success">{t('accessSent')}</Alert> : null}
      {query.access === 'failed' ? <Alert variant="danger">{t('accessFailed')}</Alert> : null}

      <Card>
        <SectionHeader title={t('loginAccess')} description={t('accessSeparationHelp')} />
        <p><strong>{t('loginEmail')}:</strong> {administrator.email ?? common('none')}</p>
        <p>
          <Badge variant={administrator.authUserId ? 'info' : 'warning'}>
            {administrator.authUserId ? t('accountLinked') : t('noAccess')}
          </Badge>
        </p>
        <p>{accessState ? t(accessState) : t('accessUnlinkedHelp')}</p>
        {!administrator.isActive ? <Alert variant="warning">{t('inactiveAccessHelp')}</Alert> : null}

        {administrator.email ? (
          <form action={resendAdministratorAccessAction} className="form-actions">
            <input name="locale" type="hidden" value={locale} />
            <input name="administratorId" type="hidden" value={administrator.id} />
            <Button type="submit" variant="secondary">
              {administrator.accountProfileId ? t('resendAccess') : t('sendAccess')}
            </Button>
          </form>
        ) : null}
      </Card>
    </section>
  );
}
