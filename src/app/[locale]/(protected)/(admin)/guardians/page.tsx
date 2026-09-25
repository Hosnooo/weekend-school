import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {GuardianManagementList} from '@/features/guardians/guardian-management-list';
import {listGuardians} from '@/features/guardians/guardian.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function GuardiansPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [guardians, t] = await Promise.all([
    listGuardians(profile.schoolId),
    getTranslations({locale, namespace: 'guardians'})
  ]);

  return (
    <section className="admin-page">
      <PageHeader
        actions={<Link className="button button-primary action-link" href="/guardians/new">{t('addGuardian')}</Link>}
        description={t('description')}
        title={t('title')}
      />
      <GuardianManagementList guardians={guardians} locale={locale} />
    </section>
  );
}
