import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {notFound} from 'next/navigation';

export default async function AdminLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  await requireProfile(locale, 'ADMIN');
  return children;
}
