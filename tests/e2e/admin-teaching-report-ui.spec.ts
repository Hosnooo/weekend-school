import {expect, test, type Page} from '@playwright/test';

import {credentials, login} from './helpers';

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

const cases = [
  {locale: 'en' as const, updates: 'Teaching Updates', open: 'Open Teaching Updates', history: 'Submitted and dismissed updates', cycles: 'Report Cycles', create: 'Create Report Cycle', historical: 'Historical Subject and Group reports'},
  {locale: 'ar' as const, updates: 'تحديثات التدريس', open: 'تحديثات التدريس المفتوحة', history: 'التحديثات المرسلة والمستبعدة', cycles: 'دورات التقارير', create: 'إنشاء دورة تقارير', historical: 'تقارير المواد والمجموعات السابقة'}
];

for (const item of cases) {
  test(`Admin Teaching Updates and Report Cycles ${item.locale} desktop and 360px`, async ({page}, testInfo) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    await page.setViewportSize({width: 1366, height: 900});
    await login(page, item.locale, credentials.admin);

    for (const width of [1366, 360]) {
      await page.setViewportSize({width, height: width === 360 ? 800 : 900});
      await page.goto(`/${item.locale}/teaching-updates`);
      await expect(page.getByRole('heading', {level: 1, name: item.updates})).toBeVisible();
      await expect(page.getByRole('heading', {level: 2, name: item.open})).toBeVisible();
      const history = page.locator('details.admin-update-history');
      await expect(history.locator('summary')).toHaveText(item.history);
      await expect(history.locator('select').first()).toBeHidden();
      await history.locator('summary').click();
      await expect(history.locator('select')).toHaveCount(2);
      await expect(history.locator('select').first()).toBeVisible();
      await noHorizontalOverflow(page);
      await page.screenshot({path: testInfo.outputPath(`${item.locale}-admin-updates-${width}.png`), fullPage: true});

      await page.goto(`/${item.locale}/reports`);
      await expect(page.getByRole('heading', {level: 2, name: item.cycles})).toBeVisible();
      const create = page.locator('details.report-cycle-create');
      const historical = page.locator('details.report-cycle-history');
      await expect(create.locator('summary')).toHaveText(item.create);
      await expect(create.locator('form')).toBeHidden();
      await expect(historical.locator('summary')).toHaveText(item.historical);
      await expect(historical.locator('form').first()).toBeHidden();
      await create.locator('summary').click();
      await expect(create.locator('form')).toBeVisible();
      await noHorizontalOverflow(page);
      await page.screenshot({path: testInfo.outputPath(`${item.locale}-report-cycles-${width}.png`), fullPage: true});
    }

    await expect(page.locator('html')).toHaveAttribute('dir', item.locale === 'ar' ? 'rtl' : 'ltr');
    expect(runtimeErrors).toEqual([]);
  });
}
