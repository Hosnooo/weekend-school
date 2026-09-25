import {notFound} from 'next/navigation';

import {AppHeader} from '@/components/layout/app-header';
import {AppNavigation} from '@/components/layout/app-navigation';
import {isLocale} from '@/i18n/config';
import {requireProfileWithCapabilities} from '@/lib/auth/require-profile';

import styles from './protected-layout.module.css';

export default async function ProtectedLayout({children,params}:Readonly<{children:React.ReactNode;params:Promise<{locale:string}>}>){
  const {locale}=await params;if(!isLocale(locale))notFound();
  const {profile,capabilities}=await requireProfileWithCapabilities(locale);
  return <div className="app-shell"><AppHeader locale={locale} profile={profile}/><div className={styles.body}><AppNavigation capabilities={capabilities}/><main className={styles.content} id="main-content">{children}</main></div></div>;
}
