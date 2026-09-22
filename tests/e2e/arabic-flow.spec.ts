import {expect, test} from '@playwright/test';

import {clearSession, credentials, login, openReportPeriod} from './helpers';

test('Arabic teacher workflow and Arabic report rendering', async ({page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await login(page, 'en', credentials.arabicTeacher);
  await page.getByRole('button', {name: 'Language'}).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.goto('/ar/my-groups/d0000000-0000-0000-0000-000000000002/update?date=2030-02-09');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', {name: 'تحديد الجميع حاضرين'}).click();
  await page.getByLabel('ماذا درست المجموعة؟ (بالعربية)').fill('درس اللغة العربية');
  await page.getByLabel('الأداء الافتراضي').selectOption('GOOD');
  await page.getByRole('button', {name: 'إرسال'}).click();
  await expect(page).toHaveURL(/\/ar\/history$/);

  await clearSession(page);
  await page.setViewportSize({width: 1280, height: 800});
  await login(page, 'ar', credentials.admin);
  await openReportPeriod(page, 'ar', '2030-02');
  await page.getByRole('button', {name: 'إنشاء التقارير'}).click();
  const reportRow = page.getByRole('row', {name: /مايا يوسف.*العربية/});
  await reportRow.getByRole('link', {name: 'معاينة'}).click();
  const frame = page.frameLocator('iframe[title="معاينة التقرير"]');
  await expect(frame.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(frame.getByText('درس اللغة العربية')).toBeVisible();
});
