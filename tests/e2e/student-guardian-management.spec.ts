import {expect, test, type Page} from '@playwright/test';

import {credentials, login} from './helpers';

const studentId = 'e0000000-0000-0000-0000-000000000001';
const studentNameEn = 'Sara Ali';
const studentNameAr = 'سارة علي';

const guardianId = 'f0000000-0000-0000-0000-000000000001';
const guardianName = 'Guardian 01';
const guardianEmail = 'guardian01@example.test';

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function assertSkipLinkHidden(page: Page) {
  const box = await page.locator('.skip-link').boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(0);
}

test.describe('Student, enrollment, and Guardian management', () => {
  test('keeps identity, enrollment, Guardians, and lifecycle clear across EN/AR and responsive layouts', async ({
    page
  }, testInfo) => {
    await page.setViewportSize({width: 1366, height: 900});
    await login(page, 'en', credentials.admin);

    // Students — desktop
    await page.goto('/en/students');
    await expect(page.getByRole('heading', {level: 1, name: 'Students'})).toBeVisible();

    const studentRow = page.getByRole('row').filter({hasText: studentNameEn});
    await expect(studentRow).toContainText('Foundations');
    await expect(studentRow).toContainText('Active');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-students-desktop.png'),
      fullPage: true
    });

    // Student read-only detail
    await studentRow.getByRole('link', {name: studentNameEn}).click();

    await expect(page).toHaveURL(new RegExp(`/en/students/${studentId}$`));
    await expect(
      page.getByRole('heading', {level: 1, name: studentNameEn})
    ).toBeVisible();

    for (const section of [
      'Identity & contact',
      'Enrollment',
      'Guardians',
      'Lifecycle'
    ]) {
      await expect(page.getByRole('heading', {level: 2, name: section})).toBeVisible();
    }

    await expect(page.getByRole('link', {name: guardianName})).toBeVisible();
    await expect(
      page.locator('p').filter({hasText: 'Current Class:'})
    ).toContainText('Foundations');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-student-detail-desktop.png'),
      fullPage: true
    });

    // Student edit is identity-only.
    await page.getByRole('link', {name: 'Edit'}).first().click();
    await expect(page).toHaveURL(new RegExp(`/en/students/${studentId}/edit$`));
    await expect(
      page.getByRole('heading', {level: 1, name: 'Edit student'})
    ).toBeVisible();
    await expect(page.getByLabel('First name (English)')).toHaveValue('Sara');
    await expect(page.getByLabel('Last name (English)')).toHaveValue('Ali');
    await expect(page.getByLabel('Class')).toHaveCount(0);
    await expect(page.getByLabel('Enrollment start')).toHaveCount(0);

    await page.goto(`/en/students/${studentId}`);

    // Enrollment is a separate workflow.
    await page.getByRole('link', {name: 'Manage enrollment'}).first().click();

    await expect(page).toHaveURL(
      new RegExp(`/en/students/${studentId}/enrollment$`)
    );
    await expect(
      page.getByRole('heading', {level: 1, name: 'Manage enrollment'})
    ).toBeVisible();
    await expect(page.getByText('Foundations', {exact: true}).first()).toBeVisible();
    await expect(page.getByText('Faith & Character', {exact: true})).toBeVisible();
    await expect(page.getByText('Arabic Reading', {exact: true})).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-student-enrollment-desktop.png'),
      fullPage: true
    });

    // Guardians — desktop
    await page.goto('/en/guardians');
    await expect(page.getByRole('heading', {level: 1, name: 'Guardians'})).toBeVisible();

    const guardianRow = page.getByRole('row').filter({hasText: guardianName});
    await expect(guardianRow).toContainText(guardianEmail);
    await expect(guardianRow).toContainText('English');
    await expect(guardianRow).toContainText('Active');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-guardians-desktop.png'),
      fullPage: true
    });

    // Guardian detail exposes linked Students.
    await guardianRow.getByRole('link', {name: guardianName}).click();

    await expect(page).toHaveURL(new RegExp(`/en/guardians/${guardianId}$`));
    await expect(
      page.getByRole('heading', {level: 1, name: guardianName})
    ).toBeVisible();

    for (const section of [
      'Identity & contact',
      'Students',
      'Lifecycle'
    ]) {
      await expect(page.getByRole('heading', {level: 2, name: section})).toBeVisible();
    }

    await expect(page.getByRole('link', {name: studentNameEn})).toBeVisible();
    await expect(page.getByText(guardianEmail, {exact: true})).toBeVisible();
    await expect(
      page.getByText('Primary guardian · Receives reports', {exact: true})
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-guardian-detail-desktop.png'),
      fullPage: true
    });

    // Guardian editing stays on the canonical Guardian route.
    await page.getByRole('link', {name: 'Edit'}).click();
    await expect(page).toHaveURL(new RegExp(`/en/guardians/${guardianId}/edit$`));
    await expect(
      page.getByRole('heading', {level: 1, name: 'Edit guardian'})
    ).toBeVisible();
    await expect(page.getByLabel('Name')).toHaveValue(guardianName);
    await expect(page.getByLabel('Email')).toHaveValue(guardianEmail);
    await expect(page.getByLabel('Report language')).toHaveValue('en');

    await page.goto('/en/guardians');

    // Students — narrow layout and overflow menu.
    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/en/students');
    await assertNoHorizontalOverflow(page);

    const mobileStudentRow = page.getByRole('row').filter({hasText: studentNameEn});
    await mobileStudentRow
      .getByRole('button', {name: `Actions: ${studentNameEn}`})
      .click();

    await expect(
      page.getByRole('menuitem', {name: 'Manage enrollment'})
    ).toBeVisible();
    await assertSkipLinkHidden(page);

    await page.screenshot({
      path: testInfo.outputPath('en-students-mobile-menu.png'),
      fullPage: true
    });

    await page.keyboard.press('Escape');

    // Guardians — narrow layout and overflow menu.
    await page.goto('/en/guardians');
    await assertNoHorizontalOverflow(page);

    const mobileGuardianRow = page.getByRole('row').filter({hasText: guardianName});
    await mobileGuardianRow
      .getByRole('button', {name: `Actions: ${guardianName}`})
      .click();

    await expect(page.getByRole('menuitem', {name: 'Edit'})).toBeVisible();
    await expect(page.getByRole('menuitem', {name: 'Deactivate'})).toBeVisible();
    await assertSkipLinkHidden(page);

    await page.screenshot({
      path: testInfo.outputPath('en-guardians-mobile-menu.png'),
      fullPage: true
    });

    await page.keyboard.press('Escape');

    // Arabic Student detail — RTL.
    await page.setViewportSize({width: 1366, height: 900});
    await page.goto(`/ar/students/${studentId}`);

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(
      page.getByRole('heading', {level: 1, name: studentNameAr})
    ).toBeVisible();

    for (const section of [
      'الهوية والتواصل',
      'التسجيل',
      'أولياء الأمور',
      'دورة الحياة'
    ]) {
      await expect(page.getByRole('heading', {level: 2, name: section})).toBeVisible();
    }

    await expect(
      page.locator('p').filter({hasText: 'الفصل الحالي:'})
    ).toContainText('الأساسيات');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-student-detail-desktop.png'),
      fullPage: true
    });

    // Arabic Guardians — desktop.
    await page.goto('/ar/guardians');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(
      page.getByRole('heading', {level: 1, name: 'أولياء الأمور'})
    ).toBeVisible();

    const arabicGuardianRow = page.getByRole('row').filter({hasText: guardianName});
    await expect(arabicGuardianRow).toContainText(guardianEmail);
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-guardians-desktop.png'),
      fullPage: true
    });

    // Arabic Guardians — narrow overflow menu.
    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/ar/guardians');
    await assertNoHorizontalOverflow(page);

    const arabicMobileGuardianRow = page
      .getByRole('row')
      .filter({hasText: guardianName});

    await arabicMobileGuardianRow.getByRole('button').click();

    await expect(page.getByRole('menuitem', {name: 'تعديل'})).toBeVisible();
    await expect(page.getByRole('menuitem', {name: 'إلغاء التفعيل'})).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ar-guardians-mobile-menu.png'),
      fullPage: true
    });
  });
});
