import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {ClassManagementList} from '@/features/classes/class-management-list';
import {listClasses} from '@/features/classes/class.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function ClassesPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireAdministrator(locale);

  const [classes, t] = await Promise.all([
    listClasses(profile.schoolId),
    getTranslations({locale, namespace: 'classes'})
  ]);

  return (
    <section className="admin-page">
      <PageHeader
        actions={
          <Link
            className="button button-primary action-link"
            href="/classes/new"
          >
            {t('createClass')}
          </Link>
        }
        description={t('description')}
        title={t('title')}
      />

      {classes.length === 0 ? (
        <EmptyState
          action={
            <Link
              className="button button-primary action-link"
              href="/classes/new"
            >
              {t('createClass')}
            </Link>
          }
          title={t('empty')}
        />
      ) : (
        <ClassManagementList classes={classes} locale={locale} />
      )}
    </section>
  );
}
