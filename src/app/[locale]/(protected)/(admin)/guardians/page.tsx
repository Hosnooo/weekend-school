import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {Card} from '@/components/ui/card';
import {PageHeader} from '@/components/ui/page-header';
import {isLocale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {requireAdministrator} from '@/lib/auth/require-profile';

export default async function GuardiansPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();

  await requireAdministrator(locale);

  const [t, studentsT] = await Promise.all([
    getTranslations({locale, namespace: 'guardians'}),
    getTranslations({locale, namespace: 'students'})
  ]);

  return (
    <section className="admin-page">
      <PageHeader
        description={t('standaloneNoticeDescription')}
        title={t('title')}
      />
      <Card>
        <h2>{t('standaloneNoticeTitle')}</h2>
        <p>{t('standaloneNoticeDescription')}</p>
        <Link
          className="button button-primary action-link"
          href="/students"
        >
          {studentsT('title')}
        </Link>
      </Card>
    </section>
  );
}
