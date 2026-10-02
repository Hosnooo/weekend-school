import {expect, test, type Page} from '@playwright/test';

import {credentials, login} from './helpers';

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

const locales = [
  {locale: 'en' as const, exportTitle: 'Export Data', archivesTitle: 'Archives', settingsTitle: 'Settings'},
  {locale: 'ar' as const, exportTitle: 'تصدير البيانات', archivesTitle: 'الأرشيف', settingsTitle: 'الإعدادات'}
];

for (const item of locales) {
  test(`Data and Settings ${item.locale} desktop and 360px`, async ({page}, testInfo) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    await login(page, item.locale, credentials.admin);

    for (const width of [1366, 360]) {
      await page.setViewportSize({width, height: width === 360 ? 800 : 900});

      await page.goto(`/${item.locale}/exports`);
      await expect(page.getByRole('heading', {level: 1, name: item.exportTitle})).toBeVisible();
      await expect(page.locator('.export-workflow').getByRole('button', {name: item.locale === 'ar' ? 'إنشاء التصدير' : 'Create export'})).toBeVisible();
      await expectNoPageOverflow(page);
      await page.screenshot({path: testInfo.outputPath(`${item.locale}-export-${width}.png`), fullPage: true});

      await page.goto(`/${item.locale}/archives`);
      await expect(page.getByRole('heading', {level: 1, name: item.archivesTitle})).toBeVisible();
      const disclosure = page.locator('details.archive-delete-disclosure').first();
      await expect(disclosure.locator('summary')).toBeVisible();
      await expect(disclosure).not.toHaveAttribute('open');
      await disclosure.locator('summary').click();
      await expect(disclosure).toHaveAttribute('open');
      await expectNoPageOverflow(page);
      await page.screenshot({path: testInfo.outputPath(`${item.locale}-archives-${width}.png`), fullPage: true});

      await page.goto(`/${item.locale}/settings`);
      await expect(page.getByRole('heading', {level: 1, name: item.settingsTitle})).toBeVisible();
      await expect(page.locator('form.settings-form')).toHaveCount(2);
      await expect(page.locator('.school-settings-section')).toBeVisible({timeout: 5_000});
      await expect(page.locator('.report-settings-section')).toBeVisible();
      await expect(page.locator('.email-settings-section')).toBeVisible();
      await expectNoPageOverflow(page);
      await page.screenshot({path: testInfo.outputPath(`${item.locale}-settings-${width}.png`), fullPage: true});
    }

    await expect(page.locator('html')).toHaveAttribute('dir', item.locale === 'ar' ? 'rtl' : 'ltr');
    expect(runtimeErrors).toEqual([]);
  });
}
