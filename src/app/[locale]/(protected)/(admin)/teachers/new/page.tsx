import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {TeacherForm} from '@/features/teachers/teacher-form';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function NewTeacherPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  await requireAdministrator(locale);
  const title = locale === 'ar' ? 'إضافة معلم' : 'Add teacher';
  const description = locale === 'ar'
    ? 'أنشئ سجل المعلم أولًا. يمكن ربط حساب دخول به لاحقًا بشكل مستقل.'
    : 'Create the Teacher record first. Account access can be linked separately afterward.';
  return <AdminPage title={title} description={description}>
    <TeacherForm locale={locale}/>
  </AdminPage>;
}
