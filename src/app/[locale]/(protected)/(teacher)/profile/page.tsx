import {notFound, redirect} from 'next/navigation';
import {isLocale} from '@/i18n/config';

// Preserve existing Teacher bookmarks; the account page is shared by all roles.
export default async function LegacyTeacherProfilePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/account`);
}
