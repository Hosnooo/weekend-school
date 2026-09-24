import {expect, test} from '@playwright/test';

import {redesign} from './redesign-fixtures';
import {clearSession, credentials, login, submitTeachingUpdate} from './helpers';

test('co-teachers submit independently and admin resolves their attendance conflict', async ({page}) => {
  await login(page, 'en', credentials.englishTeacher);
  await submitTeachingUpdate(page, {
    locale: 'en',
    classSubjectId: redesign.groupedSubjectId,
    subjectGroupId: redesign.blueGroupId,
    week: redesign.conflictWeek,
    progressEn: 'Teacher one conflict week',
    absentStudent: 'Sara Ali'
  });

  await clearSession(page);
  await login(page, 'en', credentials.arabicTeacher);
  await submitTeachingUpdate(page, {
    locale: 'en',
    classSubjectId: redesign.groupedSubjectId,
    subjectGroupId: redesign.blueGroupId,
    week: redesign.conflictWeek,
    progressEn: 'Teacher two conflict week'
  });

  await clearSession(page);
  await login(page, 'en', credentials.admin);
  await page.goto('/en/dashboard');
  const conflict = page.locator('article').filter({has: page.getByRole('heading', {name: 'Sara Ali'})});
  await expect(conflict).toContainText('English Teacher: Absent');
  await expect(conflict).toContainText('المعلمة العربية: Present');
  await conflict.getByRole('button', {name: 'Use Present'}).click();
  await expect(page.locator('article').filter({has: page.getByRole('heading', {name: 'Sara Ali'})})).toHaveCount(0);
});
