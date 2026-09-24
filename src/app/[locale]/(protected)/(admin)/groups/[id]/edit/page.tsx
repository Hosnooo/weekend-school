import {notFound, redirect} from 'next/navigation';

import {isLocale} from '@/i18n/config';

export default async function LegacyGroupEditPage({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/classes`);
}
