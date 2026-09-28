import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {listRosterImportCatalog} from '@/features/roster-csv/roster-csv.repository';
import {RosterImportForm} from '@/features/roster-csv/roster-import-form';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function StudentRosterImportPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireAdministrator(locale);

  const [catalog, t] = await Promise.all([
    listRosterImportCatalog(profile.schoolId),
    getTranslations({
      locale,
      namespace: 'students.import'
    })
  ]);

  const activeSubjectNames = catalog.subjects
    .filter((subject) => subject.isActive)
    .map((subject) =>
      locale === 'ar' && subject.nameAr
        ? subject.nameAr
        : subject.nameEn
    );

  return (
    <section className="admin-page">
      <PageHeader
        actions={
          <Link
            className="button button-secondary action-link"
            href="/students"
          >
            {t('backToStudents')}
          </Link>
        }
        description={t('description')}
        title={t('title')}
      />

      <RosterImportForm
        locale={locale}
        subjectNames={activeSubjectNames}
      />
    </section>
  );
}
