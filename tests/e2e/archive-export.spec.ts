import {expect, test} from '@playwright/test';

import {redesign} from './redesign-fixtures';
import {credentials, login} from './helpers';

test.describe.configure({retries: 0});

test('archive restore protected export and permanent delete preserve sibling data', async ({page}) => {
  await login(page, 'en', credentials.admin);
  await page.goto('/en/students?q=Archive');
  const candidateRow = page.getByRole('row', {name: /Archive Candidate/});
  await expect(candidateRow).toBeVisible();
  await candidateRow.getByRole('button', {name: 'Archive'}).click();
  await expect(page.getByRole('row', {name: /Archive Candidate/})).toHaveCount(0);

  await page.goto('/en/archives');
  let card = page.locator('article').filter({hasText: 'Archive Candidate'});
  await expect(card).toBeVisible();
  await expect(card).toContainText('Deletion impact');

  const archivedDownload = page.waitForEvent('download');
  await card.getByRole('button', {name: 'Download data'}).click();
  await expect((await archivedDownload).suggestedFilename()).toMatch(/\.(zip|xlsx)$/);

  await card.getByRole('button', {name: 'Restore'}).click();
  await expect(page.locator('article').filter({hasText: 'Archive Candidate'})).toHaveCount(0);
  await page.goto('/en/students?q=Archive');
  await expect(page.getByRole('row', {name: /Archive Candidate/})).toBeVisible();
  await page.getByRole('row', {name: /Archive Candidate/}).getByRole('button', {name: 'Archive'}).click();

  await page.goto('/en/archives');
  card = page.locator('article').filter({hasText: 'Archive Candidate'});
  await expect(card).toBeVisible();

  await page.goto('/en/exports');
  await page.getByLabel('Period').selectOption('ALL_HISTORY');
  await page.getByLabel('Scope').selectOption('SCHOOL');
  await page.getByLabel('CSV files').check();
  const schoolExport = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Create export'}).click();
  await expect((await schoolExport).suggestedFilename()).toMatch(/\.zip$/);

  await page.goto('/en/archives');
  card = page.locator('article').filter({hasText: 'Archive Candidate'});
  await expect(card).toBeVisible();
  await card.getByLabel('Confirmation').fill(`DELETE ${redesign.archiveStudentId}`);
  await card.getByRole('button', {name: 'Permanently delete'}).click();
  await expect(page.locator('article').filter({hasText: 'Archive Candidate'})).toHaveCount(0);

  await page.goto('/en/students?q=Sara');
  await expect(page.getByRole('row', {name: /Sara Ali/})).toBeVisible();
});
