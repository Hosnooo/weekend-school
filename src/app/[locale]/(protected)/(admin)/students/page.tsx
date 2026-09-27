import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Button} from '@/components/ui/button';
import {PageHeader} from '@/components/ui/page-header';
import {SearchInput} from '@/components/ui/search-input';
import {filterStudents} from '@/features/students/student.model';
import {StudentManagementList} from '@/features/students/student-management-list';
import {listStudents} from '@/features/students/student.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function StudentsPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{q?: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireAdministrator(locale);
  const query = (await searchParams).q?.slice(0, 100) ?? '';
  const [allStudents, t] = await Promise.all([
    listStudents(profile.schoolId),
    getTranslations({locale, namespace: 'students'})
  ]);
  const students = filterStudents(allStudents, query);

  return (
    <section className="admin-page">
      <PageHeader
        actions={
          <Link
            className="button button-primary action-link"
            href="/students/new"
          >
            {t('addStudent')}
          </Link>
        }
        description={t('description')}
        title={t('title')}
      />

      <form className="period-form" method="get">
        <label>
          {t('search')}
          <SearchInput defaultValue={query} name="q" />
        </label>
        <Button type="submit" variant="secondary">{t('searchAction')}</Button>
      </form>

      {students.length === 0 && query ? <p className="empty-state">{t('noSearchResults')}</p> : (
        <StudentManagementList locale={locale} students={students} />
      )}
    </section>
  );
}
