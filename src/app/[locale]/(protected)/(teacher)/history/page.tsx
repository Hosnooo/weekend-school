import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {DataTable} from '@/components/ui/data-table';
import {Badge} from '@/components/ui/badge';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {listSubmittedTeachingUpdates} from '@/features/teaching-updates/teaching-update.repository';
import {formatTeachingUpdateRange} from '@/features/teaching-updates/teaching-update-date';
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

  const [history, t, common, updates] = await Promise.all([
    listSubmittedTeachingUpdates(profile.schoolId, teacherIds),
    getTranslations({locale, namespace: 'weekly'}),
    getTranslations({locale, namespace: 'common'}),
    getTranslations({locale, namespace: 'teachingUpdates'})
  ]);

  const localName = (en: string, ar: string | null) =>
    locale === 'ar' && ar ? ar : en;

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
              key: 'context',
              header: t('subject'),
              render: (item) => (
                <div>
                  <strong className="record-name">{localName(item.subjectNameEn, item.subjectNameAr)}</strong>
                  <p className="record-meta">
                    {localName(item.classNameEn, item.classNameAr)}
                    {' · '}
                    {item.subjectGroupId
                      ? localName(item.groupNameEn ?? '', item.groupNameAr)
                      : t('wholeClass')}
                  </p>
                </div>
              )
            },
            {
              key: 'coverage',
              header: updates('coverage'),
              render: (item) => (
                <div>
                  <strong className="record-name">
                    {item.coverageKind === 'DATES' ? updates('exactDates') : updates('range')}
                  </strong>
                  <p className="record-meta">
                    {formatTeachingUpdateRange(item.periodStart, item.periodEnd, locale)}
                  </p>
                </div>
              )
            },
            {
              key: 'status',
              header: common('status'),
              render: () => (
                <Badge variant="neutral">
                  {t('submitted')}
                </Badge>
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
