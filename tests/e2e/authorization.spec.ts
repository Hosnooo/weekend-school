import {expect, test} from '@playwright/test';

import {redesign} from './redesign-fixtures';
import {clearSession, credentials, login, submitTeachingUpdate} from './helpers';

test('Teacher cannot cross Subject, co-teacher ownership, or admin role boundaries', async ({page}) => {
  await login(page, 'en', credentials.englishTeacher);
  const ownedHistoryHref = await submitTeachingUpdate(page, {
    locale: 'en',
    classSubjectId: redesign.groupedSubjectId,
    subjectGroupId: redesign.blueGroupId,
    week: redesign.authorizationWeek,
    progressEn: 'Teacher-one private submission'
  });
  expect(ownedHistoryHref).toBeTruthy();

  await clearSession(page);
  await login(page, 'en', credentials.arabicTeacher);

  await page.goto('/en/my-teaching');
  await expect(page.locator(`.teacher-new-update-row input[name="subjectGroupId"][value="${redesign.greenGroupId}"]`)).toHaveCount(1);
  await expect(page.locator(`.teacher-new-update-row input[name="classSubjectId"][value="${redesign.wholeClassSubjectId}"]`)).toHaveCount(0);

  const submissionId = ownedHistoryHref.split('/').at(-1);
  await page.goto(`/en/my-teaching/update?submissionId=${submissionId}`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();

  await page.goto(ownedHistoryHref!);
  await expect(page.getByText('This page could not be found.')).toBeVisible();

  await page.goto('/en/settings/archives');
  await expect(page).toHaveURL(/\/en\/login\?reason=access/);
});
