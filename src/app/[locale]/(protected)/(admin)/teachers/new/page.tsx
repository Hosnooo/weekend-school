import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {TeacherForm} from '@/features/teachers/teacher-form';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function NewTeacherPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  await requireAdministrator(locale);
  const t = await getTranslations({locale, namespace: 'teachers'});

  return (
    <section className="admin-page">
      <PageHeader description={t('newDescription')} title={t('newTitle')} />
      <TeacherForm locale={locale} />
    </section>
  );
}
