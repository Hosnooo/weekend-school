'use client';

import {useLocale, useTranslations} from 'next-intl';

import {changeLanguageAction} from '@/features/profiles/profile.actions';
import {Link, usePathname} from '@/i18n/navigation';

export function LanguageSwitcher({persist = false}: {persist?: boolean}) {
  const locale = useLocale();
  const pathname = usePathname();
  const translations = useTranslations('language');
  const targetLocale = locale === 'ar' ? 'en' : 'ar';
  const label =
    targetLocale === 'ar' ? translations('arabic') : translations('english');

  if (persist) {
    return (
      <form action={changeLanguageAction}>
        <input name="locale" type="hidden" value={targetLocale} />
        <input name="pathname" type="hidden" value={pathname} />
        <button
          aria-label={translations('label')}
          className="language-switcher"
          type="submit"
        >
          {label}
        </button>
      </form>
    );
  }

  return (
    <Link
      aria-label={translations('label')}
      className="language-switcher"
      href={pathname}
      locale={targetLocale}
    >
      {label}
    </Link>
  );
}
