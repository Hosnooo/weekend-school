import {getTranslations} from 'next-intl/server';

export default async function ProtectedLoading() {
  const t = await getTranslations('common');
  return <p aria-live="polite" className="loading-state" role="status">{t('loading')}</p>;
}
