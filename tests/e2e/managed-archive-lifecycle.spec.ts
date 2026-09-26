import {expect, test} from '@playwright/test';

import {credentials, login} from './helpers';

test.describe.configure({retries: 0});

test('managed archives expose safe and blocked deletion states in EN/AR', async ({page}) => {
  await login(page, 'en', credentials.admin);

  await page.goto('/en/archives');

  const safeEn = page.getByRole('row', {name: /Archived Safe Class/});
  await expect(safeEn).toBeVisible();
  await expect(safeEn).toContainText('Safe to delete');
  await expect(
    safeEn.getByRole('button', {name: 'Permanently delete'})
  ).toBeEnabled();

  const blockedEn = page.getByRole('row', {name: /Archived Blocked Class/});
  await expect(blockedEn).toBeVisible();
  await expect(blockedEn).toContainText('Deletion blocked');
  await expect(blockedEn).toContainText('Class subjects: 1');
  await expect(
    blockedEn.getByRole('button', {name: 'Permanently delete'})
  ).toBeDisabled();

  await page.goto('/ar/archives');

  const safeAr = page.getByRole('row', {name: /Archived Safe Class/});
  await expect(safeAr).toBeVisible();
  await expect(safeAr).toContainText('آمن للحذف');
  await expect(
    safeAr.getByRole('button', {name: 'حذف نهائي'})
  ).toBeEnabled();

  const blockedAr = page.getByRole('row', {name: /Archived Blocked Class/});
  await expect(blockedAr).toBeVisible();
  await expect(blockedAr).toContainText('الحذف محظور');
  await expect(blockedAr).toContainText('مواد الفصل: 1');
  await expect(
    blockedAr.getByRole('button', {name: 'حذف نهائي'})
  ).toBeDisabled();
});
