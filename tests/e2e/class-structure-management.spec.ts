import {expect, test, type Page} from '@playwright/test';

import {credentials, login} from './helpers';

const classId = '11000000-0000-0000-0000-000000000001';

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('Class, Subject, and Group school structure', () => {
  test('keeps the Class-centered hierarchy usable in EN/AR desktop and narrow layouts', async ({
    page
  }, testInfo) => {
    await page.setViewportSize({width: 1366, height: 900});
    await login(page, 'en', credentials.admin);

    // Classes list — desktop.
    await page.goto('/en/classes');
    await expect(
      page.getByRole('heading', {level: 1, name: 'Classes'})
    ).toBeVisible();

    const classRow = page.getByRole('row').filter({hasText: 'Foundations'});
    await expect(classRow).toContainText('Active');
    await expect(classRow).toContainText('2');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-classes-desktop.png'),
      fullPage: true
    });

    // Class list overflow menu.
    await classRow
      .getByRole('button', {name: 'Actions: Foundations'})
      .click();

    await expect(
      page.getByRole('menuitem', {name: 'View class'})
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', {name: 'Archive'})
    ).toBeVisible();

    await page.keyboard.press('Escape');

    // Class detail — hierarchy and coverage.
    await classRow.getByRole('link', {name: 'Foundations'}).click();
    await expect(page).toHaveURL(new RegExp(`/en/classes/${classId}$`));

    await expect(
      page.getByRole('heading', {level: 1, name: 'Foundations'})
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {level: 2, name: 'Subjects'})
    ).toBeVisible();

    const faithCard = page
      .getByRole('article')
      .filter({hasText: 'Faith & Character'});

    const arabicCard = page
      .getByRole('article')
      .filter({hasText: 'Arabic Reading'});

    await expect(faithCard).toContainText('Whole class');
    await expect(faithCard).toContainText('1 teacher');

    await expect(arabicCard).toContainText('2 groups');
    await expect(arabicCard).toContainText('Blue');
    await expect(arabicCard).toContainText('Green');
    await expect(arabicCard).toContainText('Default group');

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-class-detail-desktop.png'),
      fullPage: true
    });

    // Class editing is explicit and dialog-based.
    await page.getByRole('button', {name: 'Edit class'}).click();

    await expect(
      page.getByRole('dialog').getByRole('heading', {
        level: 2,
        name: 'Edit class'
      })
    ).toBeVisible();

    await expect(
      page.getByRole('dialog').getByLabel('Class name (English)')
    ).toHaveValue('Foundations');

    await page.getByRole('dialog').getByRole('button', {name: 'Cancel'}).click();

    // Adding a Subject is explicit and dialog-based.
    await page.getByRole('button', {name: 'Add subject'}).click();

    const addSubjectDialog = page.getByRole('dialog');
    await expect(
      addSubjectDialog.getByRole('heading', {
        level: 2,
        name: 'Add subject'
      })
    ).toBeVisible();

    await expect(
      addSubjectDialog.getByRole('heading', {
        level: 3,
        name: 'Create a new subject'
      })
    ).toBeVisible();

    await addSubjectDialog.getByRole('button', {name: 'Cancel'}).click();

    // Subject actions live in an overflow menu.
    await faithCard
      .getByRole('button', {name: 'Actions: Faith & Character'})
      .click();

    await expect(
      page.getByRole('menuitem', {name: 'Edit subject'})
    ).toBeVisible();

    await expect(
      page.getByRole('menuitem', {name: 'Manage teaching assignments'})
    ).toBeVisible();

    await expect(
      page.getByRole('menuitem', {name: 'Archive'})
    ).toBeVisible();

    // Subject edit opens a focused dialog instead of a permanent disclosure.
    await page.getByRole('menuitem', {name: 'Edit subject'}).click();

    const editSubjectDialog = page.getByRole('dialog');

    await expect(
      editSubjectDialog.getByRole('heading', {
        level: 2,
        name: 'Edit subject'
      })
    ).toBeVisible();

    await expect(
      editSubjectDialog.getByLabel('Subject name (English)')
    ).toHaveValue('Faith & Character');

    await editSubjectDialog.getByRole('button', {name: 'Cancel'}).click();

    // Add Group is also focused.
    await faithCard.getByRole('button', {name: 'Add group'}).click();

    const addGroupDialog = page.getByRole('dialog');

    await expect(
      addGroupDialog.getByRole('heading', {
        level: 2,
        name: 'Add group'
      })
    ).toBeVisible();

    await expect(
      addGroupDialog.getByLabel('Group name (English)')
    ).toBeVisible();

    await addGroupDialog.getByRole('button', {name: 'Cancel'}).click();

    // Non-default Group exposes edit/default/archive actions.
    const greenRow = arabicCard.locator('li').filter({hasText: 'Green'});

    await greenRow
      .getByRole('button', {name: 'Actions: Green'})
      .click();

    await expect(
      page.getByRole('menuitem', {name: 'Edit group'})
    ).toBeVisible();

    await expect(
      page.getByRole('menuitem', {name: 'Make default'})
    ).toBeVisible();

    await expect(
      page.getByRole('menuitem', {name: 'Archive'})
    ).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('en-group-menu-desktop.png'),
      fullPage: true
    });

    await page.keyboard.press('Escape');

    // Direct Teaching Assignments navigation.
    await page
      .getByRole('link', {name: 'Manage teaching assignments'})
      .click();

    await expect(page).toHaveURL(/\/en\/teaching-assignments$/);

    // Legacy Groups route preserves locale and lands on canonical Classes.
    await page.goto('/en/groups');
    await expect(page).toHaveURL(/\/en\/classes$/);

    // English narrow Classes management.
    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/en/classes');

    await assertNoHorizontalOverflow(page);

    const mobileClassRow = page
      .getByRole('row')
      .filter({hasText: 'Foundations'});

    await mobileClassRow
      .getByRole('button', {name: 'Actions: Foundations'})
      .click();

    await expect(
      page.getByRole('menuitem', {name: 'View class'})
    ).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('en-classes-mobile-menu.png'),
      fullPage: true
    });

    await page.keyboard.press('Escape');

    // Arabic desktop detail and RTL.
    await page.setViewportSize({width: 1366, height: 900});
    await page.goto(`/ar/classes/${classId}`);

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await expect(
      page.getByRole('heading', {level: 1, name: 'الأساسيات'})
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {level: 2, name: 'المواد'})
    ).toBeVisible();

    const arabicReadingCard = page
      .getByRole('article')
      .filter({hasText: 'القراءة العربية'});

    await expect(arabicReadingCard).toContainText('الأزرق');
    await expect(arabicReadingCard).toContainText('الأخضر');

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-class-detail-desktop.png'),
      fullPage: true
    });

    // Arabic narrow Group overflow menu.
    await page.setViewportSize({width: 360, height: 800});
    await page.goto(`/ar/classes/${classId}`);

    await assertNoHorizontalOverflow(page);

    const arabicMobileCard = page
      .getByRole('article')
      .filter({hasText: 'القراءة العربية'});

    const greenArabicRow = arabicMobileCard
      .locator('li')
      .filter({hasText: 'الأخضر'});

    await greenArabicRow
      .getByRole('button', {name: 'إجراءات: الأخضر'})
      .click();

    await expect(
      page.getByRole('menuitem', {name: 'تعديل المجموعة'})
    ).toBeVisible();

    await expect(
      page.getByRole('menuitem', {name: 'تعيين كافتراضية'})
    ).toBeVisible();

    await expect(
      page.getByRole('menuitem', {name: 'أرشفة'})
    ).toBeVisible();

    const rtlMenuBox = await page.getByRole('menu').boundingBox();
    expect(rtlMenuBox).not.toBeNull();
    expect(rtlMenuBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((rtlMenuBox?.x ?? 0) + (rtlMenuBox?.width ?? 0)).toBeLessThanOrEqual(360);

    await page.screenshot({
      path: testInfo.outputPath('ar-class-mobile-group-menu.png'),
      fullPage: true
    });

    // Arabic legacy redirect also preserves locale.
    await page.goto('/ar/groups');
    await expect(page).toHaveURL(/\/ar\/classes$/);
  });
});
