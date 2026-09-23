import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {ActionLink, AdminPage} from '@/components/ui/admin-page';
import {listClasses} from '@/features/classes/class.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth/require-profile';

export default async function ClassesPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireProfile(locale, 'ADMIN');
  const classes = await listClasses(profile.schoolId);
  const t = await getTranslations({locale, namespace: 'classes'});
  const common = await getTranslations({locale, namespace: 'common'});

  return (
    <AdminPage
      title={t('title')}
      description={t('description')}
      actions={<ActionLink href="/classes/new">{t('addClass')}</ActionLink>}
    >
      {classes.length === 0 ? (
        <p className="empty-state">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('subjects')}</th>
                <th>{common('status')}</th>
                <th>{common('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>
                      {locale === 'ar' && item.nameAr ? item.nameAr : item.nameEn}
                    </strong>
                  </td>
                  <td>{item.subjectCount}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        item.isActive ? 'status-active' : 'status-inactive'
                      }`}
                    >
                      {item.isActive ? common('active') : common('inactive')}
                    </span>
                  </td>
                  <td>
                    <Link href={`/classes/${item.id}`}>{t('openClass')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}
