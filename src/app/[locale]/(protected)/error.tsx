'use client';

import {useEffect} from 'react';
import {useTranslations} from 'next-intl';

export default function ProtectedError({
  error,
  reset
}: {
  error: Error & {digest?: string};
  reset: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="protected-status protected-error" role="alert">
      <p>{t('unexpectedError')}</p>
      <button className="button button-primary" onClick={reset} type="button">
        {t('retry')}
      </button>
    </section>
  );
}
