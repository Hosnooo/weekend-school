import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {ActionLink, AdminPage} from '@/components/ui/admin-page';
import {SchoolSettingsForm} from '@/features/school-settings/school-settings-form';
import {getSchoolSettings} from '@/features/school-settings/school-settings.repository';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function SettingsPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{saved?: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [settings, t, administrators, query] = await Promise.all([
    getSchoolSettings(profile.schoolId),
    getTranslations({locale, namespace: 'schoolSettings'}),
    getTranslations({locale, namespace: 'administrators'}),
    searchParams
  ]);
  return <AdminPage
    title={t('title')}
    description={t('description')}
    actions={<>
      <ActionLink href="/settings/administrators">{administrators('manageAction')}</ActionLink>
      <ActionLink href="/settings/archives">{locale === 'ar' ? 'الأرشيف والتصدير' : 'Archives & export'}</ActionLink>
    </>}
  >
    <SchoolSettingsForm locale={locale} settings={settings} saved={query.saved === '1'} />
  </AdminPage>;
}
