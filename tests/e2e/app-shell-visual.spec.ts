import {expect, test} from '@playwright/test';

import {credentials, login} from './helpers';

const desktopCases = [
  {locale: 'en' as const, heading: 'People', route: '/dashboard'},
  {locale: 'ar' as const, heading: 'الأشخاص', route: '/dashboard'}
];

for (const visualCase of desktopCases) {
  test(`administrator shell ${visualCase.locale} desktop`, async ({page}, testInfo) => {
    await page.setViewportSize({width: 1280, height: 900});
    await login(page, visualCase.locale, credentials.admin);
    await page.goto(`/${visualCase.locale}${visualCase.route}`);

    await expect(page.getByRole('navigation', {name: visualCase.locale === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'})).toBeVisible();
    await expect(page.getByRole('heading', {name: visualCase.heading})).toBeVisible();
    await expect(page.getByRole('button', {name: visualCase.locale === 'ar' ? 'فتح قائمة التنقل' : 'Open navigation'})).toBeHidden();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(hasHorizontalOverflow).toBe(false);

    await page.screenshot({
      path: testInfo.outputPath(`${visualCase.locale}-admin-desktop.png`),
      fullPage: true
    });
  });
}

const mobileCases = [
  {locale: 'en' as const, heading: 'My Teaching', open: 'Open navigation', nav: 'Main navigation', thisWeek: 'This Week', students: 'Students'},
  {locale: 'ar' as const, heading: 'تدريسي', open: 'فتح قائمة التنقل', nav: 'التنقل الرئيسي', thisWeek: 'هذا الأسبوع', students: 'الطلاب'}
];

for (const visualCase of mobileCases) {
  test(`teacher shell ${visualCase.locale} mobile`, async ({page}, testInfo) => {
    await page.setViewportSize({width: 390, height: 844});
    const account = visualCase.locale === 'ar' ? credentials.arabicTeacher : credentials.englishTeacher;
    await login(page, visualCase.locale, account);
    await page.goto(`/${visualCase.locale}/my-teaching`);

    const openNavigation = page.getByRole('button', {name: visualCase.open});
    await expect(openNavigation).toBeVisible();
    await openNavigation.click();

    const drawer = page.getByRole('dialog', {name: visualCase.nav});
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('heading', {name: visualCase.heading})).toBeVisible();
    await expect(drawer.getByRole('link', {name: visualCase.thisWeek})).toHaveAttribute('aria-current', 'page');
    await expect(drawer.getByRole('link', {name: visualCase.students})).toHaveCount(0);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(hasHorizontalOverflow).toBe(false);

    await page.screenshot({
      path: testInfo.outputPath(`${visualCase.locale}-teacher-mobile-drawer.png`),
      fullPage: true
    });
  });
}
