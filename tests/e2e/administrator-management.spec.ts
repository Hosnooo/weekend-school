import {expect, test} from '@playwright/test';

import {credentials, login} from './helpers';

test('Administrator management protects the last active Administrator', async ({page}) => {
  await login(page, 'en', credentials.admin);
  await page.goto('/en/settings/administrators');

  await expect(page.getByRole('heading', {name: 'Administrators'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Add administrator'})).toBeVisible();
  await expect(page.getByText('Local Admin', {exact: true})).toBeVisible();

  await page.getByRole('button', {name: 'Deactivate'}).click();
  await expect(page.getByRole('alert')).toContainText('At least one active Administrator must remain.');
  await expect(page.getByText('Active', {exact: true})).toBeVisible();
});
