import {expect, test} from '@playwright/test';

import {redesign} from './redesign-fixtures';
import {clearSession, credentials, login, submitTeachingUpdate} from './helpers';

test('English redesigned workflow reaches a finalized Class report', async ({page}) => {
  await login(page, 'en', credentials.admin);
  await page.goto(`/en/classes/${redesign.classId}`);
  await expect(page.getByRole('heading', {name: 'Foundations'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Faith & Character'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Arabic Reading'})).toBeVisible();
  await expect(page.getByText('Blue', {exact: true}).first()).toBeVisible();
  await expect(page.getByText('Green', {exact: true}).first()).toBeVisible();

  await page.goto('/en/students/e0000000-0000-0000-0000-000000000003/enrollment');
  await expect(page.getByText('Foundations', {exact: true}).first()).toBeVisible();
  const arabicReadingEnrollment = page.locator('.card').filter({hasText: 'Arabic Reading'});
  await expect(arabicReadingEnrollment).toContainText('Blue');

  await page.goto('/en/teachers/c0000000-0000-0000-0000-000000000002/assignments');
  await expect(page.getByRole('row', {name: /Foundations.*Faith & Character.*Entire subject/})).toBeVisible();
  await expect(page.getByRole('row', {name: /Foundations.*Arabic Reading.*Entire subject/})).toBeVisible();

  await clearSession(page);
  await login(page, 'en', credentials.englishTeacher);
  await submitTeachingUpdate(page, {locale: 'en', classSubjectId: redesign.wholeClassSubjectId, week: redesign.happyWeek, progressEn: 'Whole-class character lesson'});
  await submitTeachingUpdate(page, {locale: 'en', classSubjectId: redesign.groupedSubjectId, subjectGroupId: redesign.blueGroupId, week: redesign.happyWeek, progressEn: 'Blue reading lesson'});
  await submitTeachingUpdate(page, {locale: 'en', classSubjectId: redesign.groupedSubjectId, subjectGroupId: redesign.greenGroupId, week: redesign.happyWeek, progressEn: 'Green reading lesson'});

  await clearSession(page);
  await login(page, 'en', credentials.arabicTeacher);
  await submitTeachingUpdate(page, {locale: 'en', classSubjectId: redesign.groupedSubjectId, subjectGroupId: redesign.blueGroupId, week: redesign.happyWeek, progressEn: 'Second independent Blue source'});

  await clearSession(page);
  await login(page, 'en', credentials.admin);
  await page.goto('/en/reports');
  await page.getByLabel('Period start').fill('2030-01-07');
  await page.getByLabel('Period end').fill('2030-01-13');
  await page.locator('select[name="classId"]').selectOption(redesign.classId);
  await page.locator('select[name="scopeType"]').selectOption('CLASS');
  await page.getByRole('button', {name: 'Prepare report batch'}).click();
  await expect(page.getByRole('heading', {name: 'Batch review'})).toBeVisible();
  await expect(page.getByText('Blue reading lesson')).toBeVisible();
  await expect(page.getByText('Second independent Blue source')).toBeVisible();
  await page.getByRole('button', {name: 'Use all submitted sources'}).click();
  await page.getByRole('button', {name: 'Move to review'}).click();
  await page.getByRole('button', {name: 'Finalize reports'}).click();
  await expect(page.getByText('Finalized', {exact: true}).first()).toBeVisible();
  await page.getByRole('link', {name: 'Preview'}).first().click();
  const frame = page.frameLocator('iframe[title="Report preview"]');
  await expect(frame.getByText('MCE Weekend School')).toBeVisible();
  await expect(frame.getByText('Whole-class character lesson')).toBeVisible();
  await expect(frame.getByText('English Teacher')).toHaveCount(0);
});
