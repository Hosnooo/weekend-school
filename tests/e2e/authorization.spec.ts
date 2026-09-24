import {expect, test} from '@playwright/test';

import {redesign} from './redesign-fixtures';
import {clearSession, credentials, login, submitTeachingUpdate} from './helpers';

test('Group-only teacher cannot cross context, role, or co-teacher ownership boundaries', async ({page}) => {
  await login(page, 'en', credentials.englishTeacher);
  await submitTeachingUpdate(page, {
    locale: 'en',
    classSubjectId: redesign.groupedSubjectId,
    subjectGroupId: redesign.blueGroupId,
    week: redesign.authorizationWeek,
    progressEn: 'Teacher-one private submission'
  });
  const ownedHistoryHref = await page.getByRole('row', {name: /Arabic Reading.*Blue.*April/}).first().getByRole('link', {name: 'View'}).getAttribute('href');
  expect(ownedHistoryHref).toBeTruthy();

  await clearSession(page);
  await login(page, 'en', credentials.arabicTeacher);

  await page.goto(`/en/my-teaching/update?classSubjectId=${redesign.groupedSubjectId}&subjectGroupId=${redesign.greenGroupId}&week=${redesign.authorizationWeek}`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();

  await page.goto(`/en/my-teaching/update?classSubjectId=${redesign.wholeClassSubjectId}&week=${redesign.authorizationWeek}`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();

  await page.goto(ownedHistoryHref!);
  await expect(page.getByText('This page could not be found.')).toBeVisible();

  await page.goto('/en/settings/archives');
  await expect(page).toHaveURL(/\/en\/login\?reason=access/);
});
