import {createClient} from '@supabase/supabase-js';
import {expect, test, type Page} from '@playwright/test';

import {credentials, login} from './helpers';

const schoolId = 'a0000000-0000-0000-0000-000000000001';
const teacherId = 'c0000000-0000-0000-0000-000000000002';
const historicalTeacherId = 'c0000000-0000-0000-0000-000000000003';
const faithSubjectId = '13000000-0000-0000-0000-000000000001';
const arabicSubjectId = '13000000-0000-0000-0000-000000000002';
const existingArabicAssignmentId = '18000000-0000-0000-0000-000000000002';
const protectedSubmissionId = '19000000-0000-0000-0000-000000000001';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Local Supabase service credentials are required for assignment E2E setup.');
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('Teaching Assignments reference CRUD flow', () => {
  test.beforeAll(async () => {
    const supabase = serviceClient();
    const {error: cleanupError} = await supabase
      .from('teaching_assignments')
      .delete()
      .eq('school_id', schoolId)
      .eq('teacher_id', teacherId)
      .eq('class_subject_id', arabicSubjectId)
      .in('starts_on', ['2040-10-01', '2040-10-02']);
    if (cleanupError) throw cleanupError;

    const {error: windowError} = await supabase.from('teaching_assignments')
      .update({ends_on: '2026-09-30'})
      .eq('school_id', schoolId)
      .eq('id', existingArabicAssignmentId);
    if (windowError) throw windowError;

    const {error: historyError} = await supabase.from('weekly_submissions').upsert({
      id: protectedSubmissionId,
      school_id: schoolId,
      class_subject_id: faithSubjectId,
      subject_group_id: null,
      teacher_id: teacherId,
      week_start: '2026-09-21',
      status: 'SUBMITTED',
      progress_en: 'Protected E2E history',
      default_performance: 'GOOD',
      submitted_at: '2026-09-23T12:00:00Z'
    }, {onConflict: 'id', ignoreDuplicates: true});
    if (historyError) throw historyError;
  });

  test.afterAll(async () => {
    const supabase = serviceClient();
    const {error: cleanupError} = await supabase.from('teaching_assignments').delete()
      .eq('school_id', schoolId)
      .eq('teacher_id', teacherId)
      .eq('class_subject_id', arabicSubjectId)
      .in('starts_on', ['2040-10-01', '2040-10-02']);
    if (cleanupError) throw cleanupError;
    const {error: restoreError} = await supabase.from('teaching_assignments')
      .update({ends_on: null})
      .eq('school_id', schoolId)
      .eq('id', existingArabicAssignmentId);
    if (restoreError) throw restoreError;
  });

  test('creates, classifies conflicts, edits, deletes unused work, and protects submitted history', async ({page}, testInfo) => {
    test.setTimeout(300_000);
    await page.setViewportSize({width: 1366, height: 900});
    await login(page, 'en', credentials.admin);
    await page.goto(`/en/teachers/${teacherId}/assignments`);

    await expect(page.getByRole('tab', {name: 'Current'})).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/Faith & Character/)).toBeVisible();
    await expect(page.getByLabel('Starts on')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath('en-assignment-desktop.png'), fullPage: true});

    await page.getByRole('button', {name: 'Add assignment'}).click();
    const addDialog = page.getByRole('dialog', {name: 'Add assignment'});
    const classSelect = addDialog.locator('select').first();
    const subjectSelect = addDialog.locator('select[name="classSubjectId"]');
    const startsOnInput = addDialog.locator('input[name="startsOn"]');
    const appAlert = page.locator('.alert[role="alert"]');
    await expect(addDialog).toBeVisible();
    await expect(classSelect).toBeFocused();
    await expect(addDialog.locator('[name="subjectGroupId"]')).toHaveCount(0);
    await subjectSelect.selectOption({label: 'Faith & Character'});
    await startsOnInput.fill('2026-09-10');
    await addDialog.getByRole('button', {name: 'Add assignment'}).click();
    await expect(appAlert).toContainText('overlaps an existing assignment');

    await subjectSelect.selectOption({label: 'Arabic Reading'});
    await startsOnInput.fill('2040-10-01');
    await addDialog.getByRole('button', {name: 'Add assignment'}).click();
    await expect(addDialog).toBeHidden();

    await page.reload();
    await page.getByRole('tab', {name: 'Upcoming'}).click();
    await expect(page.getByText(/Foundations.*Arabic Reading/)).toBeVisible();

    await page.getByRole('button', {name: /Actions for Foundations.*Arabic Reading.*Entire subject/}).click();
    await page.getByRole('menuitem', {name: 'Edit dates'}).click();
    await page.getByLabel('Starts on').fill('2040-10-02');
    await page.getByRole('button', {name: 'Save dates'}).click();
    await expect(page.getByLabel('Starts on')).toHaveCount(0);

    await page.reload();
    await page.getByRole('tab', {name: 'Upcoming'}).click();
    await expect(page.getByText('Oct 2, 2040')).toBeVisible();
    await page.getByRole('button', {name: /Actions for Foundations.*Arabic Reading.*Entire subject/}).click();
    await page.getByRole('menuitem', {name: 'Delete assignment'}).click();
    const deleteDialog = page.getByRole('dialog', {name: 'Delete assignment'});
    await deleteDialog.getByRole('button', {name: 'Delete assignment'}).click();
    await expect(deleteDialog).toBeHidden();

    await page.reload();
    await page.getByRole('tab', {name: 'Upcoming'}).click();
    await expect(
      page.getByRole('button', {
        name: /Actions for Foundations.*Arabic Reading.*Entire subject/
      })
    ).toHaveCount(0);

    await page.getByRole('tab', {name: 'Current'}).click();
    await page.getByRole('button', {name: /Actions for Foundations.*Faith & Character.*Entire subject/}).click();
    await page.getByRole('menuitem', {name: 'Delete assignment'}).click();
    const protectedDialog = page.getByRole('dialog', {name: 'Delete assignment'});
    await protectedDialog.getByRole('button', {name: 'Delete assignment'}).click();
    await expect(protectedDialog).toBeHidden();
    await expect(appAlert).toContainText('submitted teaching history depends on it');
    await page.getByRole('button', {name: /Actions for Foundations.*Faith & Character.*Entire subject/}).click();
    await expect(page.getByRole('menuitem', {name: 'Delete assignment'})).toBeVisible();
    await page.keyboard.press('Escape');

    // A legacy Group-scoped row remains readable while authority is Subject-wide.
    await page.goto(`/en/teachers/${historicalTeacherId}/assignments`);
    await expect(page.getByText('Recorded Group: Blue (Subject-wide access)')).toBeVisible();
    await page.goto(`/en/teachers/${teacherId}/assignments`);

    await page.setViewportSize({width: 360, height: 800});
    await page.reload();
    await assertNoHorizontalOverflow(page);
    await page.getByRole('button', {name: /Actions for Foundations.*Faith & Character.*Entire subject/}).click();
    await page.screenshot({path: testInfo.outputPath('en-assignment-mobile-menu.png'), fullPage: true});
    await page.keyboard.press('Escape');

    await page.setViewportSize({width: 1366, height: 900});
    await page.goto(`/ar/teachers/${teacherId}/assignments`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('tab', {name: 'الحالية'})).toHaveAttribute('aria-selected', 'true');
    await assertNoHorizontalOverflow(page);
    await page.getByRole('button', {name: 'إضافة تعيين'}).click();
    await expect(page.getByRole('dialog', {name: 'إضافة تعيين'})).toBeVisible();
    await page.screenshot({path: testInfo.outputPath('ar-assignment-desktop-dialog.png'), fullPage: true});
    await page.getByRole('button', {name: 'إلغاء'}).click();

    await page.setViewportSize({width: 360, height: 800});
    await page.reload();
    await assertNoHorizontalOverflow(page);
    await page.getByRole('button', {name: /إجراءات .*الإيمان والأخلاق.*المادة كاملة/}).click();
    await expect(page.getByRole('menuitem', {name: 'حذف التعيين'})).toBeVisible();
    await page.screenshot({path: testInfo.outputPath('ar-assignment-mobile-menu.png'), fullPage: true});
  });
});
