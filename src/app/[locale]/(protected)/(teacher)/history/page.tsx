import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {DataTable} from '@/components/ui/data-table';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {StatusBadge} from '@/components/ui/status-badge';
import {listTeacherHistory} from '@/features/weekly-updates/weekly-update.repository';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireTeachingAccount} from '@/lib/auth/require-profile';

export default async function HistoryPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  const {profile, teacherIds} = await requireTeachingAccount(locale);

  const [history, t, common] = await Promise.all([
    listTeacherHistory(profile.schoolId, teacherIds),
    getTranslations({locale, namespace: 'weekly'}),
    getTranslations({locale, namespace: 'common'})
  ]);

  const localName = (en: string, ar: string | null) =>
    locale === 'ar' && ar ? ar : en;

  const formatWeek = (weekStart: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'long'
    }).format(new Date(`${weekStart}T12:00:00Z`));

  return (
    <section className="admin-page">
      <PageHeader
        description={t('historyDescription')}
        title={t('history')}
      />

      {history.length === 0 ? (
        <EmptyState title={t('noHistory')} />
      ) : (
        <DataTable
          columns={[
            {
              key: 'week',
              header: t('week'),
              render: (item) => formatWeek(item.weekStart)
            },
            {
              key: 'class',
              header: t('class'),
              render: (item) =>
                localName(item.classNameEn, item.classNameAr)
            },
            {
              key: 'subject',
              header: t('subject'),
              render: (item) =>
                localName(item.subjectNameEn, item.subjectNameAr)
            },
            {
              key: 'group',
              header: t('group'),
              render: (item) =>
                item.subjectGroupId
                  ? localName(
                      item.groupNameEn ?? '',
                      item.groupNameAr
                    )
                  : t('wholeClass')
            },
            {
              key: 'status',
              header: common('status'),
              render: () => (
                <StatusBadge status="active">
                  {t('submitted')}
                </StatusBadge>
              )
            },
            {
              key: 'actions',
              header: common('actions'),
              render: (item) => (
                <Link
                  className="button button-secondary button-compact action-link"
                  href={`/history/${item.id}`}
                >
                  {t('view')}
                </Link>
              )
            }
          ]}
          getRowKey={(item) => item.id}
          rows={history}
        />
      )}
    </section>
  );
}
