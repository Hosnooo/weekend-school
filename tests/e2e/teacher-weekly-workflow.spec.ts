import {expect, test, type Page} from '@playwright/test';

import {clearSession, credentials, login} from './helpers';
import {redesign} from './redesign-fixtures';

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function openStudentGroupUpdate(page: Page, locale: 'en' | 'ar') {
  const row = page.locator('.teacher-new-update-row')
    .filter({has: page.locator(`input[name="classSubjectId"][value="${redesign.groupedSubjectId}"]`)})
    .filter({has: page.locator(`input[name="subjectGroupId"][value="${redesign.blueGroupId}"]`)});
  await row.getByRole('button', {name: locale === 'ar' ? 'تحديث تدريس جديد' : 'New Teaching Update'}).click();
}

test.describe('Teacher Teaching Update workflow', () => {
  test('creates and continues flexible updates in English and Arabic at desktop and 360px', async ({page}, testInfo) => {
    test.setTimeout(300_000);
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });

    await page.setViewportSize({width: 1366, height: 900});
    await login(page, 'en', credentials.englishTeacher);
    await page.goto('/en/my-teaching');

    await expect(page.getByRole('heading', {level: 1, name: 'Teaching Updates'})).toBeVisible();
    await expect(page.locator('.teacher-new-update-list')).toBeVisible();
    await expect(page.locator('.teacher-new-update-list').getByText('students', {exact: false})).toHaveCount(0);
    const englishGroups = page.locator('.teacher-group-management');
    await expect(englishGroups.locator('summary')).toHaveText('Manage groups', {timeout: 10_000});
    await expect(englishGroups.getByRole('button', {name: 'Create group'}).first()).toBeHidden();
    await englishGroups.locator('summary').click();
    await expect(englishGroups.getByRole('button', {name: 'Create group'}).first()).toBeVisible();
    await englishGroups.locator('summary').click();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath('en-teacher-queue-desktop.png'), fullPage: true, caret: 'initial'});

    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/en/my-teaching');
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath('en-teacher-queue-mobile.png'), fullPage: true, caret: 'initial'});

    await openStudentGroupUpdate(page, 'en');
    await expect(page).toHaveURL(/\/en\/my-teaching\/update\?submissionId=/);
    const englishUpdateHref = page.url();

    await expect(page.getByRole('radio', {name: 'Date range'})).toBeChecked();
    await page.getByRole('radio', {name: 'Selected dates'}).check();
    await page.getByLabel('Date', {exact: true}).fill('2040-10-02');
    await page.getByRole('button', {name: 'Add date'}).click();
    await expect(page.getByRole('button', {name: 'Submit update'})).toBeDisabled();

    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath('en-teacher-update-mobile.png'), fullPage: true, caret: 'initial'});

    await page.getByRole('button', {name: 'Save update'}).click();
    await expect(page.locator('.save-status')).toContainText('Saved');
    await page.goto('/en/my-teaching');
    await expect(page.locator(`a[href="${new URL(englishUpdateHref).pathname}${new URL(englishUpdateHref).search}"]`)).toBeVisible();
    await expect(page.getByText(/Selected dates · .*2040/).first()).toBeVisible();

    await page.setViewportSize({width: 1366, height: 900});
    await page.goto(englishUpdateHref);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath('en-teacher-update-desktop.png'), fullPage: true, caret: 'initial'});

    await page.goto('/en/my-teaching');
    await openStudentGroupUpdate(page, 'en');
    await expect(page.getByRole('radio', {name: 'Date range'})).toBeChecked();
    await page.getByRole('button', {name: 'Mark all present'}).click();
    await page.getByLabel('What did you cover? (English)').fill('Flexible Teaching Update E2E');
    await page.getByLabel('Default performance').selectOption('GOOD');
    await page.getByRole('button', {name: 'Save update'}).click();
    await expect(page.locator('.save-status')).toContainText('Saved');
    await page.getByRole('button', {name: 'Submit update'}).click();
    await expect(page).toHaveURL(/\/en\/history$/);

    await clearSession(page);
    await login(page, 'ar', credentials.arabicTeacher);
    await page.goto('/ar/my-teaching');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', {level: 1, name: 'تحديثات التدريس'})).toBeVisible();
    await expect(page.locator('.teacher-new-update-list')).toBeVisible();
    const arabicGroups = page.locator('.teacher-group-management');
    await expect(arabicGroups.locator('summary')).toHaveText('إدارة المجموعات');
    await expect(arabicGroups.getByRole('button', {name: 'إنشاء مجموعة'}).first()).toBeHidden();
    await arabicGroups.locator('summary').click();
    await expect(arabicGroups.getByRole('button', {name: 'إنشاء مجموعة'}).first()).toBeVisible();
    await arabicGroups.locator('summary').click();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath('ar-teacher-queue-desktop.png'), fullPage: true, caret: 'initial'});

    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/ar/my-teaching');
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath('ar-teacher-queue-mobile.png'), fullPage: true, caret: 'initial'});

    await openStudentGroupUpdate(page, 'ar');
    await expect(page).toHaveURL(/\/ar\/my-teaching\/update\?submissionId=/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('radio', {name: 'نطاق تاريخ'})).toBeChecked();
    await page.getByRole('radio', {name: 'تواريخ محددة'}).check();
    await page.getByLabel('التاريخ', {exact: true}).fill('2040-10-02');
    await page.getByRole('button', {name: 'إضافة تاريخ'}).click();
    await expect(page.getByRole('button', {name: 'إرسال التحديث'})).toBeDisabled();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath('ar-teacher-update-mobile.png'), fullPage: true, caret: 'initial'});

    await page.setViewportSize({width: 1366, height: 900});
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath('ar-teacher-update-desktop.png'), fullPage: true, caret: 'initial'});
    expect(runtimeErrors).toEqual([]);
  });
});
