import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';
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
  await requireAdministrator(locale);
  return children;
}
