import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {GuardianForm} from '@/features/guardians/guardian-form';
import {getGuardian} from '@/features/guardians/guardian.repository';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function EditGuardianPage({params}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [guardian, t] = await Promise.all([
    getGuardian(profile.schoolId, id),
    getTranslations({locale, namespace: 'guardians'})
  ]);
  if (!guardian) notFound();

  return (
    <section className="admin-page">
      <PageHeader
        breadcrumbs={[
          {label: t('title'), href: `/${locale}/guardians`},
          {label: guardian.name, href: `/${locale}/guardians/${guardian.id}`},
          {label: t('editTitle')}
        ]}
        description={t('description')}
        title={t('editTitle')}
      />
      <GuardianForm cancelHref={`/guardians/${guardian.id}`} guardian={guardian} locale={locale} />
    </section>
  );
}
