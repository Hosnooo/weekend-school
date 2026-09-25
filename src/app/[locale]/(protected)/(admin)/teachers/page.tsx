import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {TeacherManagementList} from '@/features/teachers/teacher-management-list';
import {getTeacherAccessStates, listTeachers} from '@/features/teachers/teacher.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function TeachersPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const teachers = await listTeachers(profile.schoolId);
  const [accessStates, t] = await Promise.all([
    getTeacherAccessStates(teachers),
    getTranslations({locale, namespace: 'teachers'})
  ]);

  return (
    <section className="admin-page">
      <PageHeader
        actions={<Link className="button button-primary action-link" href="/teachers/new">{t('addTeacher')}</Link>}
        description={t('description')}
        title={t('title')}
      />
      <TeacherManagementList accessStates={accessStates} locale={locale} teachers={teachers} />
    </section>
  );
}
