import {createClient} from '@supabase/supabase-js';
import {expect, test, type Page} from '@playwright/test';

import {credentials, login} from './helpers';

const schoolId = 'a0000000-0000-0000-0000-000000000001';
const teacherId = 'c0000000-0000-0000-0000-000000000002';
const faithSubjectId = '13000000-0000-0000-0000-000000000001';
const arabicSubjectId = '13000000-0000-0000-0000-000000000002';
const blueGroupId = '14000000-0000-0000-0000-000000000001';
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
      .eq('subject_group_id', blueGroupId);
    if (cleanupError) throw cleanupError;

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
    }, {onConflict: 'id'});
    if (historyError) throw historyError;
  });

  test('creates, classifies conflicts, edits, deletes unused work, and protects submitted history', async ({page}, testInfo) => {
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
    await expect(addDialog).toBeVisible();
    await expect(addDialog.getByLabel('Class', {exact: true})).toBeFocused();
    await addDialog.getByLabel('Subject', {exact: true}).selectOption({label: 'Faith & Character'});
    await addDialog.getByLabel('Starts on', {exact: true}).fill('2026-09-10');
    await addDialog.getByRole('button', {name: 'Add assignment'}).click();
    await expect(page.getByRole('alert')).toContainText('overlaps an existing assignment');

    await addDialog.getByLabel('Subject', {exact: true}).selectOption({label: 'Arabic Reading'});
    await addDialog.getByLabel('Scope', {exact: true}).selectOption({label: 'Blue'});
    await addDialog.getByLabel('Starts on', {exact: true}).fill('2026-10-01');
    await addDialog.getByRole('button', {name: 'Add assignment'}).click();
    await expect(addDialog).toBeHidden();

    await page.reload();
    await page.getByRole('tab', {name: 'Upcoming'}).click();
    await expect(page.getByText('Blue')).toBeVisible();

    await page.getByRole('button', {name: /Actions for Foundations.*Arabic Reading.*Blue/}).click();
    await page.getByRole('menuitem', {name: 'Edit dates'}).click();
    await page.getByLabel('Starts on').fill('2026-10-02');
    await page.getByRole('button', {name: 'Save dates'}).click();

    await page.reload();
    await page.getByRole('tab', {name: 'Upcoming'}).click();
    await expect(page.getByText(/2026-10-02/)).toBeVisible();
    await page.getByRole('button', {name: /Actions for Foundations.*Arabic Reading.*Blue/}).click();
    await page.getByRole('menuitem', {name: 'Delete assignment'}).click();
    const deleteDialog = page.getByRole('dialog', {name: 'Delete assignment'});
    await deleteDialog.getByRole('button', {name: 'Delete assignment'}).click();

    await page.reload();
    await page.getByRole('tab', {name: 'Upcoming'}).click();
    await expect(page.getByText('Blue')).toHaveCount(0);

    await page.getByRole('tab', {name: 'Current'}).click();
    await page.getByRole('button', {name: /Actions for Foundations.*Faith & Character.*Entire subject/}).click();
    await page.getByRole('menuitem', {name: 'Delete assignment'}).click();
    const protectedDialog = page.getByRole('dialog', {name: 'Delete assignment'});
    await protectedDialog.getByRole('button', {name: 'Delete assignment'}).click();
    await expect(page.getByRole('alert')).toContainText('submitted teaching history depends on it');
    await page.getByRole('button', {name: /Actions for Foundations.*Faith & Character.*Entire subject/}).click();
    await expect(page.getByRole('menuitem', {name: 'Delete assignment'})).toBeVisible();
    await page.keyboard.press('Escape');

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
