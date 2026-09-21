import {expect, test} from '@playwright/test';

import {credentials, login} from './helpers';

test('teacher cannot open another teacher group by identifier', async ({page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await login(page, 'en', credentials.englishTeacher);
  const response = await page.goto('/en/my-groups/d0000000-0000-0000-0000-000000000002/update?date=2030-04-13');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', {name: 'Intermediate'})).toHaveCount(0);
});
