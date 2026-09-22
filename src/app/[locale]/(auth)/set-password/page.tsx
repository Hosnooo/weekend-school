import {getTranslations} from 'next-intl/server';

import {SetPasswordForm} from './set-password-form';

export default async function SetPasswordPage({params}:{params:Promise<{locale:'en'|'ar'}>}) {
  const {locale}=await params;
  const t=await getTranslations({locale,namespace:'auth'});
  return <main className="auth-shell"><section className="auth-card"><h1>{t('setPasswordTitle')}</h1><p>{t('setPasswordDescription')}</p><SetPasswordForm locale={locale}/></section></main>;
}
