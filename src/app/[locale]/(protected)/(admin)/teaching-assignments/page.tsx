import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {AdminPage} from '@/components/ui/admin-page';
import {listTeachers} from '@/features/teachers/teacher.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function TeachingAssignmentsIndexPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireAdministrator(locale);

  const [teachers, t] = await Promise.all([
    listTeachers(profile.schoolId),
    getTranslations({locale, namespace: 'teachingAssignmentsIndex'})
  ]);

  return (
    <AdminPage title={t('title')} description={t('description')}>
      {teachers.length === 0 ? (
        <p className="empty-state">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('teacher')}</th>
                <th>{t('current')}</th>
                <th>{t('access')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>
                    <strong>{teacher.displayName}</strong>
                  </td>
                  <td>{teacher.assignmentCount}</td>
                  <td>{teacher.authUserId ? t('linked') : t('none')}</td>
                  <td>
                    <Link
                      className="button button-secondary action-link"
                      href={`/teachers/${teacher.id}/assignments`}
                    >
                      {t('manage')}
                    </Link>
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
