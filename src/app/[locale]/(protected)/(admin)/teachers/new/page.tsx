import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {TeacherForm} from '@/features/teachers/teacher-form';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function NewTeacherPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  await requireProfile(locale, 'ADMIN');
  const t = await getTranslations({locale, namespace: 'teachers'});
  return <AdminPage title={t('newTitle')} description={t('description')}>
    <TeacherForm locale={locale} />
  </AdminPage>;
}
