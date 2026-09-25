'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {useDialogClose} from '@/components/ui/dialog';
import {Sheet, SheetClose} from '@/components/ui/sheet';
import type {AccountCapabilities} from '@/lib/auth/authorization';
import {
  getNavigationSections,
  type NavigationSection,
  type NavigationSectionId
} from '@/lib/auth/navigation';

import styles from './app-navigation.module.css';

type AppNavigationProps = {capabilities: AccountCapabilities};

const sectionMessageKeys: Record<NavigationSectionId, string> = {
  overview: 'overview',
  people: 'people',
  school: 'school',
  reports: 'reportsSection',
  data: 'data',
  settings: 'settingsSection',
  myTeaching: 'myTeaching'
};

function NavigationContent({sections, className}: {sections: readonly NavigationSection[]; className?: string}) {
  const pathname = usePathname();
  const locale = useLocale() === 'ar' ? 'ar' : 'en';
  const t = useTranslations('navigation');
  const closeDialog = useDialogClose();

  return (
    <nav aria-label={t('label')} className={`${styles.navigation} ${className ?? ''}`.trim()}>
      {sections.map((section) => (
        <section className={styles.section} key={section.id}>
          <h2>{t(sectionMessageKeys[section.id])}</h2>
          <div className={styles.links}>
            {section.items.map((item) => {
              const href = `/${locale}${item.href}`;
              const isCurrent = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`${styles.link} ${isCurrent ? styles.current : ''}`.trim()}
                  href={href}
                  key={item.href}
                  onClick={() => closeDialog?.()}
                >
                  {t(item.messageKey)}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

export function AppNavigation({capabilities}: AppNavigationProps) {
  const t = useTranslations('navigation');
  const sections = getNavigationSections(capabilities);

  return (
    <div className={styles.shellNavigation}>
      <div className={styles.desktopNavigation}>
        <NavigationContent sections={sections} />
      </div>
      <div className={styles.mobileNavigation}>
        <Sheet
          title={t('label')}
          trigger={<Button variant="secondary">{t('openNavigation')}</Button>}
        >
          <NavigationContent className={styles.drawerNavigation} sections={sections} />
          <div className={styles.drawerActions}>
            <SheetClose>{t('closeNavigation')}</SheetClose>
          </div>
        </Sheet>
      </div>
    </div>
  );
}
