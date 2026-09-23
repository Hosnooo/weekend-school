import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {ClassForm} from '@/features/classes/class-form';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function NewClassPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  await requireProfile(locale, 'ADMIN');
  const t = await getTranslations({locale, namespace: 'classes'});

  return (
    <AdminPage title={t('newTitle')} description={t('description')}>
      <ClassForm locale={locale} />
    </AdminPage>
  );
}
