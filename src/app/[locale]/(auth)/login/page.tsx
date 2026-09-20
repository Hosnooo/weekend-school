import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {LanguageSwitcher} from '@/components/layout/language-switcher';
import {isLocale} from '@/i18n/config';

import {LoginForm} from './login-form';

export default async function LoginPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const app = await getTranslations('app');

  return (
    <main className="auth-shell" id="main-content">
      <section className="auth-card">
        <div className="auth-heading">
          <h1>{app('name')}</h1>
          <LanguageSwitcher />
        </div>
        <LoginForm locale={locale} />
      </section>
    </main>
  );
}
