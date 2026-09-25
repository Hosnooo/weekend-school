import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {TeacherForm} from '@/features/teachers/teacher-form';
import {getTeacher} from '@/features/teachers/teacher.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function EditTeacherPage({params}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const [teacher, t] = await Promise.all([
    getTeacher(profile.schoolId, id),
    getTranslations({locale, namespace: 'teachers'})
  ]);
  if (!teacher) notFound();

  return (
    <section className="admin-page">
      <PageHeader
        actions={<Link className="button button-secondary action-link" href={`/teachers/${teacher.id}`}>{t('backToTeacher')}</Link>}
        description={t('editDescription')}
        title={t('editTitle')}
      />
      <TeacherForm locale={locale} teacher={teacher} />
    </section>
  );
}
