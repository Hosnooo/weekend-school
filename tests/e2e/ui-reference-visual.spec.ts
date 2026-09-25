import {expect, test} from '@playwright/test';

import {credentials, login} from './helpers';

const cases = [
  {locale: 'en' as const, mode: 'desktop', width: 1280, height: 900, dir: 'ltr'},
  {locale: 'ar' as const, mode: 'desktop', width: 1280, height: 900, dir: 'rtl'},
  {locale: 'en' as const, mode: 'mobile', width: 390, height: 844, dir: 'ltr'},
  {locale: 'ar' as const, mode: 'mobile', width: 390, height: 844, dir: 'rtl'}
];

for (const visualCase of cases) {
  test(`UI reference ${visualCase.locale} ${visualCase.mode}`, async ({page}, testInfo) => {
    await page.setViewportSize({width: visualCase.width, height: visualCase.height});
    await login(page, visualCase.locale, credentials.admin);
    await page.goto(`/${visualCase.locale}/ui-reference`);

    await expect(page.locator('html')).toHaveAttribute('dir', visualCase.dir);
    await expect(page.locator('.ui-reference')).toBeVisible();
    await expect(page.locator('.data-table')).toBeVisible();
    await expect(page.getByRole('button').first()).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath(`${visualCase.locale}-${visualCase.mode}.png`),
      fullPage: true
    });
  });
}
