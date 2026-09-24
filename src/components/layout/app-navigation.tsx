'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';

import {getNavigationItems, type AppRole} from '@/lib/auth/navigation';

type AppNavigationProps = {
  role: AppRole;
};

export function AppNavigation({role}: AppNavigationProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const translations = useTranslations('navigation');

  return (
    <nav aria-label={translations('label')} className="app-navigation">
      {getNavigationItems(role).map((item) => {
        const href = `/${locale}${item.href}`;
        const isCurrent = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            aria-current={isCurrent ? 'page' : undefined}
            className={isCurrent ? 'bg-[var(--background)] font-bold' : undefined}
            href={href}
            key={item.href}
          >
            {translations(item.messageKey)}
          </Link>
        );
      })}
    </nav>
  );
}
