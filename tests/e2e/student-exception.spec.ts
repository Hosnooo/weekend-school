import {expect, test} from '@playwright/test';

import {redesign} from './redesign-fixtures';
import {credentials, login, submitTeachingUpdate} from './helpers';

test('student exception remains sparse and visible in submitted history', async ({page}) => {
  await login(page, 'en', credentials.englishTeacher);
  const historyHref = await submitTeachingUpdate(page, {
    locale: 'en',
    classSubjectId: redesign.groupedSubjectId,
    subjectGroupId: redesign.blueGroupId,
    week: redesign.exceptionWeek,
    progressEn: 'Exception workflow lesson',
    exceptionStudent: 'Omar Hassan'
  });

  await page.goto(historyHref);
  const exception = page.getByRole('row', {name: /Omar Hassan/}).locator('select').nth(1);
  await expect(exception).toBeDisabled();
  await expect(exception).toHaveValue('EXCELLENT');
  await expect(page.getByText('Exception workflow lesson')).toBeVisible();
  await expect(page.getByText('Submitted', {exact: true})).toBeVisible();
});
