import {expect, test} from '@playwright/test';

import {credentials, login} from './helpers';

const foundationClassId = '11000000-0000-0000-0000-000000000001';
const existingStudentId = 'e0000000-0000-0000-0000-000000000001';

test('Class page enrolls an existing student without moving them, then creates a new student in that Class', async ({page}) => {
  await login(page, 'en', credentials.admin);
  await page.goto('/en/classes/new');
  await page.getByLabel('Class name (English)').fill('Multi-Class E2E');
  await page.getByLabel('Class start date').fill('2026-09-01');
  await page.getByRole('button', {name: 'Save'}).click();

  await expect(page.getByRole('heading', {level: 1, name: 'Multi-Class E2E'})).toBeVisible();
  const newClassUrl = page.url();
  expect(newClassUrl).toMatch(/\/en\/classes\/[a-f0-9-]{36}$/);

  const existing = page.locator('.guardian-directory-option').filter({hasText: 'Sara Ali'});
  await existing.locator('input[type="checkbox"]').check();
  await page.getByLabel('Enrollment start date').fill('2026-10-10');
  await page.getByRole('button', {name: 'Enroll selected (1)'}).click();
  await expect(page.getByRole('link', {name: 'Sara Ali'})).toBeVisible();

  await page.goto(`/en/students/${existingStudentId}`);
  await expect(page.getByRole('heading', {level: 3, name: 'Foundations'})).toBeVisible();
  await expect(page.getByRole('heading', {level: 3, name: 'Multi-Class E2E'})).toBeVisible();

  await page.goto(`/en/classes/${foundationClassId}`);
  await expect(page.getByRole('link', {name: 'Sara Ali'})).toBeVisible();

  await page.goto(newClassUrl);
  await page.getByRole('link', {name: 'Create and enroll new student'}).click();
  await expect(page.locator('select[name="classId"]')).toHaveValue(
    newClassUrl.split('/').at(-1)!
  );
  await page.getByLabel('First name (English)').fill('MultiClass');
  await page.getByLabel('Last name (English)').fill('NewStudent');
  await page.getByRole('button', {name: 'Save'}).click();
  await expect(page).toHaveURL(newClassUrl);
  await expect(page.getByRole('link', {name: 'MultiClass NewStudent'})).toBeVisible();
});
