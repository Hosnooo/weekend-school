import {expect, test, type Locator} from '@playwright/test';

import {credentials, login} from './helpers';

const cases = [
  {locale: 'en' as const, mode: 'desktop', width: 1280, height: 900, dir: 'ltr'},
  {locale: 'ar' as const, mode: 'desktop', width: 1280, height: 900, dir: 'rtl'},
  {locale: 'en' as const, mode: 'mobile', width: 390, height: 844, dir: 'ltr'},
  {locale: 'ar' as const, mode: 'mobile', width: 390, height: 844, dir: 'rtl'}
];

async function expectHitTestVisible(locator: Locator) {
  await expect(locator).toBeVisible();
  const visibleAtCenter = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
    const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit && (hit === element || element.contains(hit)));
  });
  expect(visibleAtCenter).toBe(true);
}

for (const visualCase of cases) {
  test(`UI reference ${visualCase.locale} ${visualCase.mode}`, async ({page}, testInfo) => {
    await page.setViewportSize({width: visualCase.width, height: visualCase.height});
    await login(page, visualCase.locale, credentials.admin);
    await page.goto(`/${visualCase.locale}/ui-reference`);

    await expect(page.locator('html')).toHaveAttribute('dir', visualCase.dir);
    await expect(page.locator('.ui-reference')).toBeVisible();
    await expect(page.locator('.data-table')).toBeVisible();
    await expect(page.getByRole('button').first()).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(hasHorizontalOverflow).toBe(false);

    const tabs = page.getByRole('tablist').getByRole('tab');
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await tabs.nth(0).click();

    const dialogTrigger = page.locator('button[aria-haspopup="dialog"]').first();
    await dialogTrigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogTrigger).toBeFocused();

    await page.screenshot({
      path: testInfo.outputPath(`${visualCase.locale}-${visualCase.mode}-base.png`),
      fullPage: true
    });

    if (visualCase.mode === 'desktop') {
      const menuTrigger = page.locator('.data-table button[aria-haspopup="menu"]').first();
      await menuTrigger.click();
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();
      const menuItems = menu.getByRole('menuitem');
      await expect(menuItems).toHaveCount(2);
      await expectHitTestVisible(menuItems.nth(0));
      await expectHitTestVisible(menuItems.nth(1));
      await page.screenshot({
        path: testInfo.outputPath(`${visualCase.locale}-${visualCase.mode}-menu.png`),
        fullPage: true
      });
      await page.keyboard.press('Escape');
      await expect(menuTrigger).toBeFocused();
    } else {
      const layeredTriggers = page.locator('button[aria-haspopup="dialog"]');
      const sheetTrigger = layeredTriggers.nth(1);
      await sheetTrigger.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`${visualCase.locale}-${visualCase.mode}-sheet.png`),
        fullPage: true
      });
      await page.keyboard.press('Escape');
      await expect(sheetTrigger).toBeFocused();
    }
  });
}
