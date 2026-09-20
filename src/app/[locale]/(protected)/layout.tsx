import {AppHeader} from '@/components/layout/app-header';
import {AppNavigation} from '@/components/layout/app-navigation';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {notFound} from 'next/navigation';

export default async function ProtectedLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const profile = await requireProfile(locale);

  return (
    <div className="app-shell">
      <AppHeader locale={locale} profile={profile} />
      <AppNavigation role={profile.role} />
      <main className="app-content" id="main-content">
        {children}
      </main>
    </div>
  );
}
