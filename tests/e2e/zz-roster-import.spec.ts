import {expect, test} from '@playwright/test';

import {credentials, login} from './helpers';

const headers = [
  'student_first_name_en',
  'student_last_name_en',
  'guardian_name',
  'guardian_email',
  'guardian_phone',
  'class',
  'enrollment_start_date'
].join(',');

function rosterCsv(className: string, email: string) {
  return `${headers}\r\nAudit,Student,Audit Guardian,${email},7805550199,${className},2026-09-01\r\n`;
}

test('Administrator previews and confirms a roster import that creates a Class', async ({page}) => {
  await login(page, 'en', credentials.admin);
  await page.goto('/en/students/import');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'audit-roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(rosterCsv('Release Audit Class', 'roster.audit@example.test'))
  });
  await page.getByRole('button', {name: 'Preview import'}).click();

  await expect(page.getByRole('cell', {name: 'Release Audit Class · Create Class'})).toBeVisible();
  await page.getByRole('button', {name: 'Confirm import'}).click();
  await expect(page.getByText('Import complete')).toBeVisible();

  await page.goto('/en/classes');
  await expect(page.getByText('Release Audit Class')).toBeVisible();
});

test('Arabic roster preview shows the new Class label in RTL', async ({page}) => {
  await login(page, 'ar', credentials.admin);
  await page.goto('/ar/students/import');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'arabic-roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(rosterCsv('Arabic Audit Class', 'roster.arabic@example.test'))
  });
  await page.getByRole('button', {name: 'معاينة الاستيراد'}).click();

  await expect(page.getByRole('cell', {name: 'Arabic Audit Class · إنشاء فصل'})).toBeVisible();
});
