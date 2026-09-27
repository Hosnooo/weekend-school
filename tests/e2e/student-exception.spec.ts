import {expect, test} from '@playwright/test';

import {redesign} from './redesign-fixtures';
import {credentials, login, submitTeachingUpdate} from './helpers';

test('student exception remains sparse and visible in submitted history', async ({page}) => {
  await login(page, 'en', credentials.englishTeacher);
  await submitTeachingUpdate(page, {
    locale: 'en',
    classSubjectId: redesign.groupedSubjectId,
    subjectGroupId: redesign.blueGroupId,
    week: redesign.exceptionWeek,
    progressEn: 'Exception workflow lesson',
    exceptionStudent: 'Omar Hassan'
  });

  const row = page
    .getByRole('row', {name: /March.*Foundations.*Arabic Reading.*Blue/})
    .first();
  await row.getByRole('link', {name: 'View'}).click();
  const exceptionToggle = page.getByRole('button', {name: 'Omar Hassan'});
  await expect(exceptionToggle).toBeDisabled();
  await expect(exceptionToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Performance override')).toHaveValue('EXCELLENT');
  await expect(page.getByText('Exception workflow lesson')).toBeVisible();
  await expect(page.getByText('Submitted', {exact: true})).toBeVisible();
});
