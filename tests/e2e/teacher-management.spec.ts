import {createClient} from '@supabase/supabase-js';
import {expect, test, type Page} from '@playwright/test';

import {credentials, login} from './helpers';

const schoolId = 'a0000000-0000-0000-0000-000000000001';
const teacherId = 'c0000000-0000-0000-0000-000000000004';
const teacherName = 'No Login Teacher';
const teacherEmail = 'teacher.noaccess@example.test';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Local Supabase service credentials are required for Teacher E2E setup.');
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('Teacher record, access, and teaching coverage separation', () => {
  test.beforeAll(async () => {
    const supabase = serviceClient();
    const {error: linksError} = await supabase.from('teacher_accounts').delete()
      .eq('school_id', schoolId)
      .eq('teacher_id', teacherId);
    if (linksError) throw linksError;

    const {error: teacherError} = await supabase.from('teachers').upsert({
      id: teacherId,
      school_id: schoolId,
      display_name: teacherName,
      email: teacherEmail,
      preferred_language: 'en',
      is_active: true
    }, {onConflict: 'id'});
    if (teacherError) throw teacherError;
  });

  test('finds a Teacher without login, manages access, opens assignments, and returns to the record', async ({page}, testInfo) => {
    test.setTimeout(240_000);
    await page.setViewportSize({width: 1366, height: 900});
    await login(page, 'en', credentials.admin);
    await page.goto('/en/teachers');

    const row = page.getByRole('row').filter({hasText: teacherName});
    await expect(row).toContainText('Active');
    await expect(row).toContainText('No account linked');
    await expect(row).toContainText('0 active assignments');
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath('en-teachers-desktop.png'), fullPage: true});

    await row.getByRole('button', {name: `Actions for ${teacherName}`}).click();
    await page.getByRole('menuitem', {name: 'Manage login access'}).click();
    await expect(page).toHaveURL(new RegExp(`/en/teachers/${teacherId}/access$`));
    await expect(page.getByRole('heading', {level: 1, name: `${teacherName} — Login access`})).toBeVisible();
    await expect(page.getByText('No account linked', {exact: true})).toBeVisible();
    await page.screenshot({path: testInfo.outputPath('en-teacher-access-desktop.png'), fullPage: true});

    await page.getByRole('button', {name: 'Enable login access'}).click();
    await expect(page).toHaveURL(new RegExp(`/en/teachers/${teacherId}/access\\?access=sent$`));
    await expect(page.locator('.alert')).toContainText('Login access updated.');
    await expect(page.getByText('Account linked', {exact: true})).toBeVisible();

    await page.getByRole('link', {name: 'Back to teacher'}).click();
    await expect(page).toHaveURL(new RegExp(`/en/teachers/${teacherId}$`));
    for (const section of ['Identity & contact', 'Login access', 'Teaching summary', 'Lifecycle']) {
      await expect(page.getByRole('heading', {level: 2, name: section})).toBeVisible();
    }

    await page.getByRole('link', {name: 'Manage teaching assignments'}).click();
    await expect(page).toHaveURL(new RegExp(`/en/teachers/${teacherId}/assignments$`), {timeout: 60_000});
    await expect(page.getByRole('heading', {level: 1, name: `${teacherName} — Teaching assignments`})).toBeVisible();
    await page.getByRole('link', {name: 'Back to teacher'}).click();
    await expect(page).toHaveURL(new RegExp(`/en/teachers/${teacherId}$`));

    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/en/teachers');
    await assertNoHorizontalOverflow(page);
    await page.getByRole('row').filter({hasText: teacherName})
      .getByRole('button', {name: `Actions for ${teacherName}`}).click();
    await expect(page.getByRole('menuitem', {name: 'Manage login access'})).toBeVisible();
    await page.screenshot({path: testInfo.outputPath('en-teachers-mobile-menu.png'), fullPage: true});
    await page.keyboard.press('Escape');

    await page.setViewportSize({width: 1366, height: 900});
    await page.goto(`/ar/teachers/${teacherId}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', {level: 1, name: teacherName})).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath('ar-teacher-detail-desktop.png'), fullPage: true});

    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/ar/teachers');
    await assertNoHorizontalOverflow(page);
    const arabicRow = page.getByRole('row').filter({hasText: teacherName});
    await arabicRow.getByRole('button').click();
    await expect(page.getByRole('menuitem', {name: 'إدارة صلاحية الدخول'})).toBeVisible();
    await page.screenshot({path: testInfo.outputPath('ar-teachers-mobile-menu.png'), fullPage: true});
  });
});
