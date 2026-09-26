import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {SchoolSettingsForm} from '@/features/school-settings/school-settings-form';
import {getSchoolSettings} from '@/features/school-settings/school-settings.repository';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function SettingsPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{saved?: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireAdministrator(locale);

  const [settings, t, query] = await Promise.all([
    getSchoolSettings(profile.schoolId),
    getTranslations({locale, namespace: 'schoolSettings'}),
    searchParams
  ]);

  return (
    <section className="admin-page">
      <PageHeader
        title={t('title')}
        description={t('description')}
      />

      <SchoolSettingsForm
        locale={locale}
        settings={settings}
        saved={query.saved === '1'}
      />
    </section>
  );
}
