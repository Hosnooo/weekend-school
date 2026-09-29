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
      page.getByRole('heading', {level: 2, name: 'Needs attention', exact: true})
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {level: 2, name: 'In progress'})
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {level: 2, name: 'Quick actions'})
    ).toBeVisible();

    // All active Teachers currently have login linkage.
    await expect(
      page.getByText('Teachers without login access', {exact: true})
    ).toHaveCount(0);

    // Both seeded active Teachers have current teaching assignments.
    await expect(
      page.getByText('Teachers without current assignments', {exact: true})
    ).toHaveCount(0);

    await expect(page.getByRole('heading', {name: 'School overview'})).toHaveCount(0);
    await expect(page.getByRole('heading', {name: 'This week'})).toHaveCount(0);

    await expect(
      page.getByRole('link', {name: 'Add student'})
    ).toHaveAttribute('href', '/en/students/new');
    await expect(
      page.getByRole('link', {name: 'Create Report Cycle'})
    ).toHaveAttribute('href', '/en/reports');

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

    await expect(page.getByRole('heading', {level: 2, name: 'Quick actions'})).toBeVisible();

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

    await expect(page.getByRole('heading', {level: 2, name: 'قيد العمل'})).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-dashboard-desktop.png'),
      fullPage: true
    });

    // Arabic narrow.
    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/ar/dashboard');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await expect(page.getByRole('heading', {level: 2, name: 'إجراءات سريعة'})).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-dashboard-mobile.png'),
      fullPage: true
    });
  });
});
