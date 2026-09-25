import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {GuardianForm} from '@/features/guardians/guardian-form';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function NewGuardianPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  await requireAdministrator(locale);
  const t = await getTranslations({locale, namespace: 'guardians'});

  return (
    <section className="admin-page">
      <PageHeader
        breadcrumbs={[
          {label: t('title'), href: `/${locale}/guardians`},
          {label: t('newTitle')}
        ]}
        description={t('description')}
        title={t('newTitle')}
      />
      <GuardianForm locale={locale} />
    </section>
  );
}
