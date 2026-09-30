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
  await expect(page.getByText('Blue', {exact: true}).first()).toBeVisible();

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
  const createCycle = page.locator('details.report-cycle-create');
  await createCycle.locator('summary').click();
  await createCycle.locator('select[name="classId"]').selectOption(redesign.classId);
  await createCycle.locator('input[name="periodStart"]').fill(redesign.happyWeek);
  await createCycle.locator('input[name="periodEnd"]').fill('2026-09-14');
  await createCycle.getByRole('button', {name: 'Create Report Cycle'}).click();
  await expect(page.getByRole('heading', {name: 'Report Cycle · Foundations'})).toBeVisible();
  await expect(page.locator('.report-source-list').first().locator('.report-source-row').filter({hasText: 'Arabic Reading · Blue'})).toHaveCount(2);
  await page.getByRole('button', {name: 'Generate student reports'}).click();
  await expect(page.getByText('Ready to send', {exact: true}).first()).toBeVisible();
  await page.getByRole('link', {name: 'Preview report'}).first().click();
  const frame = page.frameLocator('iframe[title="Report preview"]');
  await expect(frame.getByText('MCE Weekend School')).toBeVisible();
  await expect(frame.getByText('Whole-class character lesson')).toBeVisible();
  await expect(frame.getByText('Blue reading lesson')).toBeVisible();
  await expect(frame.getByText('Second independent Blue source')).toBeVisible();
  await expect(frame.getByText('English Teacher')).toHaveCount(0);
});
