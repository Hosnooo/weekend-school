import {getTranslations} from 'next-intl/server';

import type {NavigationItem} from '@/lib/auth/navigation';

type FoundationPageProps = {
  titleKey: NavigationItem['messageKey'];
  emptyState?: boolean;
};

export async function FoundationPage({titleKey, emptyState = false}: FoundationPageProps) {
  const navigation = await getTranslations('navigation');
  const foundation = await getTranslations('foundation');

  return (
    <section className="foundation-page">
      <h1>{navigation(titleKey)}</h1>
      <p>{emptyState ? foundation('noGroups') : foundation('pageDescription')}</p>
    </section>
  );
}
