import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {DataTable, type DataTableColumn} from '@/components/ui/data-table';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {listTeachers} from '@/features/teachers/teacher.repository';
import type {TeacherListItem} from '@/features/teachers/teacher.types';
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

  const columns: DataTableColumn<TeacherListItem>[] = [
    {
      key: 'teacher',
      header: t('teacher'),
      render: (teacher) => (
        <Link href={`/teachers/${teacher.id}/assignments`}>
          <strong className="record-name">{teacher.displayName}</strong>
        </Link>
      )
    },
    {key: 'current', header: t('current'), render: (teacher) => teacher.assignmentCount},
    {key: 'access', header: t('access'), render: (teacher) => teacher.authUserId ? t('linked') : t('none')},
    {
      key: 'actions',
      header: t('manage'),
      render: (teacher) => (
        <Link className="button button-secondary button-compact action-link" href={`/teachers/${teacher.id}/assignments`}>
          {t('manage')}
        </Link>
      )
    }
  ];

  return (
    <section className="admin-page">
      <PageHeader description={t('description')} title={t('title')} />
      {teachers.length === 0 ? <EmptyState title={t('empty')} /> : (
        <DataTable
          caption={t('title')}
          columns={columns}
          getRowKey={(teacher) => teacher.id}
          rows={teachers}
        />
      )}
    </section>
  );
}
