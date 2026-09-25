import {expect, test, type Page} from '@playwright/test';

import {credentials, login} from './helpers';

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );

  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('Administrator dashboard', () => {
  test('prioritizes actionable attention in EN/AR desktop and narrow layouts', async ({
    page
  }, testInfo) => {
    await page.setViewportSize({width: 1366, height: 900});
    await login(page, 'en', credentials.admin);
    await page.goto('/en/dashboard');

    await expect(
      page.getByRole('heading', {level: 1, name: 'Dashboard'})
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {level: 2, name: 'Attention'})
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {level: 2, name: 'School overview'})
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {level: 2, name: 'This week'})
    ).toBeVisible();

    // All active Teachers currently have login linkage.
    await expect(
      page.getByText('Teachers without login access', {exact: true})
    ).toHaveCount(0);

    // One active Teacher currently has no teaching assignment.
    await expect(
      page.getByText('Teachers without current assignments', {exact: true})
    ).toBeVisible();

    await expect(
      page.getByRole('link', {name: 'Manage assignments'})
    ).toHaveAttribute('href', '/en/teaching-assignments');

    // The current seeded week has expected teaching work that still needs updates.
    await expect(
      page.getByText('Missing weekly updates', {exact: true})
    ).toBeVisible();

    await expect(
      page.getByRole('link', {name: 'Review this week'})
    ).toHaveAttribute('href', '#this-week');

    await expect(
      page.getByRole('link', {name: 'Add student'})
    ).toHaveAttribute('href', '/en/students/new');

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-dashboard-desktop.png'),
      fullPage: true
    });

    // English narrow.
    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/en/dashboard');

    await expect(
      page.getByRole('heading', {level: 1, name: 'Dashboard'})
    ).toBeVisible();

    await expect(
      page.getByText('Missing weekly updates', {exact: true})
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-dashboard-mobile.png'),
      fullPage: true
    });

    // Arabic desktop.
    await page.setViewportSize({width: 1366, height: 900});
    await page.goto('/ar/dashboard');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await expect(
      page.getByRole('heading', {level: 1, name: 'لوحة التحكم'})
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {level: 2, name: 'بحاجة إلى متابعة'})
    ).toBeVisible();

    await expect(
      page.getByText('تحديثات أسبوعية مفقودة', {exact: true})
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-dashboard-desktop.png'),
      fullPage: true
    });

    // Arabic narrow.
    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/ar/dashboard');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await expect(
      page.getByText('تحديثات أسبوعية مفقودة', {exact: true})
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-dashboard-mobile.png'),
      fullPage: true
    });
  });
});
