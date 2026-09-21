import {expect, test} from '@playwright/test';

import {clearSession, credentials, login, openReportPeriod} from './helpers';

test('student exception overrides the group default in reports', async ({page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await login(page, 'en', credentials.englishTeacher);
  await page.goto('/en/my-groups/d0000000-0000-0000-0000-000000000001/update?date=2030-03-09');
  await page.getByRole('button', {name: 'Mark all present'}).click();
  await page.getByLabel('What did the group cover? (English)').fill('Exception workflow lesson');
  await page.getByLabel('Default performance').selectOption('GOOD');
  await page.getByRole('button', {name: 'Omar Hassan'}).click();
  await page.getByLabel('Performance override').selectOption('EXCELLENT');
  await page.getByRole('button', {name: 'Submit'}).click();

  await clearSession(page);
  await page.setViewportSize({width: 1280, height: 800});
  await login(page, 'en', credentials.admin);
  await openReportPeriod(page, 'en', '2030-03');
  await page.getByRole('button', {name: 'Generate reports'}).click();

  const saraRow = page.getByRole('row', {name: /Sara Ali.*English/});
  await saraRow.getByRole('link', {name: 'Preview'}).click();
  await expect(page.frameLocator('iframe[title="Report preview"]').getByText('Good', {exact: true})).toBeVisible();
  await page.getByRole('link', {name: 'Back to reports'}).click();

  const omarRow = page.getByRole('row', {name: /Omar Hassan.*English/});
  await omarRow.getByRole('link', {name: 'Preview'}).click();
  await expect(page.frameLocator('iframe[title="Report preview"]').getByText('Excellent', {exact: true})).toBeVisible();
});
