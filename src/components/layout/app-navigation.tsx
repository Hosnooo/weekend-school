'use client';

import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';

import {getNavigationItems, type AppRole} from '@/lib/auth/navigation';

type AppNavigationProps = {
  role: AppRole;
};

export function AppNavigation({role}: AppNavigationProps) {
  const locale = useLocale();
  const translations = useTranslations('navigation');

  return (
    <nav aria-label={translations('label')} className="app-navigation">
      {getNavigationItems(role).map((item) => (
        <Link key={item.href} href={`/${locale}${item.href}`}>
          {translations(item.messageKey)}
        </Link>
      ))}
    </nav>
  );
}
