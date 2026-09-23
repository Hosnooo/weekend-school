import {expect, test} from '@playwright/test';

import {credentials, login} from './helpers';

test('teacher cannot open another teacher group by identifier', async ({page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await login(page, 'en', credentials.englishTeacher);
  await page.goto('/en/my-groups/d0000000-0000-0000-0000-000000000002/update?date=2030-04-13');
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Intermediate'})).toHaveCount(0);

  await page.goto('/en/login');
  await page.getByRole('link', {name: 'Forgot password?'}).click();
  await expect(page).toHaveURL(/\/en\/forgot-password$/);
  await page.getByLabel('Email').fill(credentials.englishTeacher.email);
  await page.getByRole('button', {name: 'Send reset link'}).click();
  await expect(page.getByRole('status')).toHaveText('If an account exists for that email, a reset link has been sent.');
  await page.getByLabel('Email').fill('missing@example.test');
  await page.getByRole('button', {name: 'Send reset link'}).click();
  await expect(page.getByRole('status')).toHaveText('If an account exists for that email, a reset link has been sent.');
});
