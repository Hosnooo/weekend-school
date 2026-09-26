import {expect, test, type Page} from '@playwright/test';

import {clearSession, credentials, login} from './helpers';

type Locale = 'en' | 'ar';

const adminRoutes = [
  '/dashboard',
  '/students',
  '/teachers',
  '/teaching-assignments',
  '/classes',
  '/reports',
  '/archives'
] as const;

const teacherRoutes = [
  '/my-teaching',
  '/history'
] as const;

async function expectLocaleAndNoRootOverflow(
  page: Page,
  locale: Locale
) {
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('html')).toHaveAttribute(
    'dir',
    locale === 'ar' ? 'rtl' : 'ltr'
  );

  await expect(page.locator('main')).toBeVisible();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));

  expect(
    overflow.scrollWidth,
    `root horizontal overflow: ${overflow.scrollWidth}px > ${overflow.clientWidth}px`
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

for (const locale of ['en', 'ar'] as const) {
  test(`Administrator surfaces remain usable at 360px in ${locale}`, async ({
    page
  }) => {
    await page.setViewportSize({width: 360, height: 800});
    await clearSession(page);
    await login(page, locale, credentials.admin);

    for (const route of adminRoutes) {
      await page.goto(`/${locale}${route}`);
      await expectLocaleAndNoRootOverflow(page, locale);
    }
  });

  test(`Administrator surfaces remain usable on desktop in ${locale}`, async ({
    page
  }) => {
    await page.setViewportSize({width: 1280, height: 800});
    await clearSession(page);
    await login(page, locale, credentials.admin);

    for (const route of adminRoutes) {
      await page.goto(`/${locale}${route}`);
      await expectLocaleAndNoRootOverflow(page, locale);
    }
  });

  test(`Teacher surfaces remain usable at 360px in ${locale}`, async ({
    page
  }) => {
    await page.setViewportSize({width: 360, height: 800});
    await clearSession(page);
    await login(page, locale, credentials.englishTeacher);

    for (const route of teacherRoutes) {
      await page.goto(`/${locale}${route}`);
      await expectLocaleAndNoRootOverflow(page, locale);
    }
  });
}
