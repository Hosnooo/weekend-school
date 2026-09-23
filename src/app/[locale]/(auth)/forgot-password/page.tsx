import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {isLocale} from '@/i18n/config';

import {ForgotPasswordForm} from './forgot-password-form';

export default async function ForgotPasswordPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({locale, namespace: 'auth'});
  return <main className="auth-shell" id="main-content"><section className="auth-card">
    <h1>{t('forgotPasswordTitle')}</h1><p>{t('forgotPasswordDescription')}</p>
    <ForgotPasswordForm locale={locale} />
  </section></main>;
}
