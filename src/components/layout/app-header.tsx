import {getTranslations} from 'next-intl/server';

import {logoutAction} from '@/app/[locale]/(auth)/login/actions';
import {LanguageSwitcher} from '@/components/layout/language-switcher';
import {Button} from '@/components/ui/button';
import type {Profile} from '@/features/profiles/profile.types';
import type {Locale} from '@/i18n/config';

type AppHeaderProps = {
  locale: Locale;
  profile: Profile;
};

export async function AppHeader({locale, profile}: AppHeaderProps) {
  const app = await getTranslations('app');
  const auth = await getTranslations('auth');

  return (
    <header className="app-header">
      <div>
        <p className="app-name">{app('name')}</p>
        <p className="profile-name">{profile.displayName}</p>
      </div>
      <div className="header-actions">
        <LanguageSwitcher persist />
        <form action={logoutAction}>
          <input name="locale" type="hidden" value={locale} />
          <Button type="submit" variant="secondary">
            {auth('signOut')}
          </Button>
        </form>
      </div>
    </header>
  );
}
