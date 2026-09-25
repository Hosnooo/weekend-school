'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';

import type {AccountCapabilities} from '@/lib/auth/authorization';
import {getNavigationSections, type NavigationMessageKey} from '@/lib/auth/navigation';

import styles from './app-navigation.module.css';

type AppNavigationProps = {capabilities: AccountCapabilities};

const englishLabels: Record<NavigationMessageKey, string> = {
  dashboard:'Dashboard', students:'Students', guardians:'Guardians', teachers:'Teachers', administrators:'Administrators', classesSubjects:'Classes & Subjects', teachingAssignments:'Teaching Assignments', reports:'Reports', exportData:'Export Data', archives:'Archives', settings:'Settings', thisWeek:'This Week', history:'History', myProfile:'My Profile'
};
const arabicLabels: Record<NavigationMessageKey, string> = {
  dashboard:'لوحة التحكم', students:'الطلاب', guardians:'أولياء الأمور', teachers:'المعلمون', administrators:'المسؤولون', classesSubjects:'الفصول والمواد', teachingAssignments:'تعيينات التدريس', reports:'التقارير', exportData:'تصدير البيانات', archives:'الأرشيف', settings:'الإعدادات', thisWeek:'هذا الأسبوع', history:'السجل', myProfile:'ملفي الشخصي'
};

export function AppNavigation({capabilities}:AppNavigationProps){
  const locale=useLocale()==='ar'?'ar':'en';const pathname=usePathname();const translations=useTranslations('navigation');
  const copy=locale==='ar'?arabicLabels:englishLabels;const headings=locale==='ar'?{administration:'الإدارة',myTeaching:'تدريسي'}:{administration:'Administration',myTeaching:'My Teaching'};
  return <nav aria-label={translations('label')} className={styles.navigation}>{getNavigationSections(capabilities).map((section)=><section className={styles.section} key={section.id}>
    <h2>{headings[section.id]}</h2><div className={styles.links}>{section.items.map((item)=>{const href=`/${locale}${item.href}`;const isCurrent=pathname===href||pathname.startsWith(`${href}/`);return <Link aria-current={isCurrent?'page':undefined} className={`${styles.link} ${isCurrent?styles.current:''}`.trim()} href={href} key={item.href}>{copy[item.messageKey]}</Link>;})}</div>
  </section>)}</nav>;
}
