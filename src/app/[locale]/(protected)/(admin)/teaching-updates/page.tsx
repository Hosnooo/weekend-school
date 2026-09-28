import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {PageHeader} from '@/components/ui/page-header';
import {
  listAdminTeachingUpdateContexts,
  listAdminTeachingUpdateRequestSets,
  listAdminTeachingUpdates
} from '@/features/teaching-updates/admin-teaching-update.repository';
import {AdminTeachingUpdatesWorkspace} from '@/features/teaching-updates/admin-teaching-updates-workspace';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';

type SearchValue = string | string[] | undefined;

export default async function AdminTeachingUpdatesPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, SearchValue>>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireProfile(locale, 'ADMIN');
  const query = await searchParams;

  const [updates, requestSets, contexts, t] = await Promise.all([
    listAdminTeachingUpdates(profile.schoolId),
    listAdminTeachingUpdateRequestSets(profile.schoolId),
    listAdminTeachingUpdateContexts(profile.schoolId),
    getTranslations({locale, namespace: 'adminTeachingUpdates'})
  ]);

  const notice =
    query.requested === '1'
      ? t('requested')
      : query.reopened === '1'
        ? t('reopened')
        : query.dismissed === '1'
          ? t('dismissedNotice')
          : query.error === 'validation'
            ? t('validationError')
            : query.error === 'request'
              ? t('requestError')
              : query.error === 'reopen'
                ? t('reopenError')
                : query.error === 'dismiss'
                  ? t('dismissError')
                  : null;

  return (
    <section className="admin-page">
      <PageHeader
        description={t('description')}
        title={t('title')}
      />

      <AdminTeachingUpdatesWorkspace
        contexts={contexts}
        locale={locale}
        notice={notice}
        requestSets={requestSets}
        updates={updates}
      />
    </section>
  );
}
