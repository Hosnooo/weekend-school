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

  // Numeric attendance is reviewed and reconciled within its Class Report
  // Cycle, rather than in the legacy Present/Absent Dashboard widget.
  await page.goto('/en/reports');
  const create = page.locator('details.report-cycle-create');
  await create.locator('summary').click();
  await create.locator('select[name="classId"]').selectOption(redesign.classId);
  await create.locator('input[name="periodStart"]').fill(redesign.conflictWeek);
  await create.locator('input[name="periodEnd"]').fill(redesign.conflictWeek);
  await create.getByRole('button', {name: 'Create Report Cycle'}).click();

  const context = page.locator('.report-source-context')
    .filter({hasText: 'Arabic Reading · Blue'});
  await expect(context.locator('.report-source-row')).toHaveCount(2);
  await context.getByRole('link', {name: 'Edit update'}).click();

  const editor = context.locator('.report-source-editor:visible');
  await expect(editor).toBeVisible();
  const sara = editor.locator('article.record-card').filter({hasText: 'Sara Ali'});
  await expect(sara).toContainText('Source attendance disagrees');

  // All students with overlapping numeric sources need a deliberate Admin
  // override; setting just one student's status cannot resolve the cycle.
  for (const student of await editor.locator('article.record-card').all()) {
    await student.locator('input[name^="attendanceAttended:"]').fill('1');
    await student.locator('input[name^="attendanceTotal:"]').fill('1');
  }
  await editor.getByRole('button', {name: 'Save & close'}).click();
  await expect(editor).toBeHidden();

  await context.getByRole('link', {name: 'Edit update'}).click();
  const reopened = context.locator('.report-source-editor:visible');
  const resolvedSara = reopened.locator('article.record-card').filter({hasText: 'Sara Ali'});
  await expect(resolvedSara.locator('input[name^="attendanceAttended:"]')).toHaveValue('1');
  await expect(resolvedSara.locator('input[name^="attendanceTotal:"]')).toHaveValue('1');
  await expect(resolvedSara).not.toContainText('Source attendance disagrees');
});
