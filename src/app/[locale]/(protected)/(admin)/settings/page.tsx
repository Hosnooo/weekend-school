import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {SchoolSettingsForm} from '@/features/school-settings/school-settings-form';
import {getSchoolSettings} from '@/features/school-settings/school-settings.repository';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function SettingsPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{saved?: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireProfile(locale, 'ADMIN');
  const [settings, t, query] = await Promise.all([
    getSchoolSettings(profile.schoolId),
    getTranslations({locale, namespace: 'schoolSettings'}),
    searchParams
  ]);
  return <AdminPage title={t('title')} description={t('description')}>
    <SchoolSettingsForm locale={locale} settings={settings} saved={query.saved === '1'} />
  </AdminPage>;
}
