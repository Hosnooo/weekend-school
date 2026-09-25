import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {ClassForm} from '@/features/classes/class-form';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function NewClassPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  await requireAdministrator(locale);
  const t = await getTranslations({locale, namespace: 'classes'});

  return (
    <section className="admin-page">
      <PageHeader
        breadcrumbLabel={t('breadcrumbLabel')}
        breadcrumbs={[
          {label: t('title'), href: `/${locale}/classes`},
          {label: t('newTitle')}
        ]}
        description={t('description')}
        title={t('newTitle')}
      />

      <ClassForm locale={locale} />
    </section>
  );
}
