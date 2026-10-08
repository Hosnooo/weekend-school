import {expect, test, type Page} from '@playwright/test';

import {credentials, login} from './helpers';

const studentId = 'e0000000-0000-0000-0000-000000000001';
const studentNameEn = 'Sara Ali';
const studentNameAr = 'سارة علي';

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
    test.setTimeout(300_000);
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

    await expect(page).toHaveURL(new RegExp(`/en/students/${studentId}$`), {timeout: 60_000});
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

    await expect(page.getByText(guardianName, {exact: true})).toBeVisible();
    await expect(page.getByText(guardianEmail, {exact: true})).toBeVisible();
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

    // Guardian management is centered on the Student record.
    await page.goto(`/en/students/${studentId}`);

    const addGuardianDetails = page
      .locator('details')
      .filter({hasText: 'Add new guardian'})
      .last();

    await addGuardianDetails.locator('summary').click();
    await addGuardianDetails.getByLabel('Name').fill('Second Guardian');
    await addGuardianDetails
      .getByLabel('Email')
      .fill('second.guardian@example.test');
    await addGuardianDetails
      .getByLabel('Phone')
      .fill('+1 780 555 0300');
    await addGuardianDetails
      .getByLabel('Report language')
      .selectOption('both');

    await addGuardianDetails
      .getByRole('button', {name: 'Add new guardian'})
      .click();

    const secondGuardian = page
      .locator('.record-card')
      .filter({hasText: 'Second Guardian'});

    await expect(secondGuardian).toBeVisible();
    await expect(secondGuardian).toContainText('second.guardian@example.test');
    await expect(secondGuardian).toContainText('+1 780 555 0300');
    await expect(secondGuardian).toContainText('Receives reports');

    // Edit the Guardian from the Student record.
    await secondGuardian.locator('summary').click();
    await secondGuardian
      .getByLabel('Name')
      .fill('Second Guardian Updated');
    await secondGuardian
      .getByRole('button', {name: 'Save'})
      .click();

    await expect(
      page.getByText('Second Guardian Updated', {exact: true})
    ).toBeVisible();

    // Unlinking removes only this Student relationship.
    const updatedGuardian = page
      .locator('.record-card')
      .filter({hasText: 'Second Guardian Updated'});

    page.once('dialog', (dialog) => dialog.accept());
    await updatedGuardian
      .getByRole('button', {name: 'Remove from student'})
      .click();

    // Unlinking changes this student's relationship, not necessarily the
    // global Guardian directory. Check the linked-card action specifically.
    await expect(
      page.locator('.record-card')
        .filter({hasText: 'Second Guardian Updated'})
        .filter({has: page.getByRole('button', {name: 'Remove from student'})})
    ).toHaveCount(0);

    // The standalone Guardians route is informational only.
    await page.goto('/en/guardians');
    await expect(
      page.getByRole('heading', {level: 1, name: 'Guardians'})
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Guardian management has moved'
      })
    ).toBeVisible();
    await expect(
      page.locator('#main-content').getByRole('link', {name: 'Students'})
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

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

    // Student Guardian management remains usable at 360px.
    await page.goto(`/en/students/${studentId}`);
    await expect(
      page.locator('summary').filter({hasText: 'Add new guardian'})
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertSkipLinkHidden(page);

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

    // Arabic standalone Guardians route is informational and RTL-safe.
    await page.goto('/ar/guardians');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(
      page.getByRole('heading', {level: 1, name: 'أولياء الأمور'})
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'تم نقل إدارة أولياء الأمور'
      })
    ).toBeVisible();
    await expect(
      page.locator('#main-content').getByRole('link', {name: 'الطلاب'})
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/ar/guardians');
    await assertNoHorizontalOverflow(page);
    await assertSkipLinkHidden(page);

  });
});
