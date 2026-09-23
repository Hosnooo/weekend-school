import {isLocale} from '@/i18n/config';
import {requireTeachingProfile} from '@/lib/auth/require-profile';
import {notFound} from 'next/navigation';

export default async function TeacherLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  await requireTeachingProfile(locale);
  return children;
}
