import {expect, test, type Page} from '@playwright/test';

import {
  clearSession,
  credentials,
  login
} from './helpers';

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );

  expect(overflow).toBeLessThanOrEqual(1);
}

async function assertStickyDoesNotCoverLastStudent(page: Page) {
  const lastFields = page.locator('.exception-fields').last();
  const lastControl = lastFields.locator('textarea').last();
  const sticky = page.locator('.sticky-actions');

  await expect(lastFields).toBeVisible();
  await expect(lastControl).toBeVisible();
  await expect(sticky).toBeVisible();

  await lastControl.evaluate((element) => {
    element.scrollIntoView({block: 'center'});
  });

  const controlBox = await lastControl.boundingBox();
  const stickyBox = await sticky.boundingBox();

  expect(controlBox).not.toBeNull();
  expect(stickyBox).not.toBeNull();

  if (controlBox && stickyBox) {
    expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(
      stickyBox.y + 1
    );
  }
}

test.describe('Teacher weekly workflow', () => {
  test('supports EN/AR desktop and 360px weekly work', async ({
    page
  }, testInfo) => {
    // English desktop queue.
    await page.setViewportSize({width: 1366, height: 900});
    await login(page, 'en', credentials.englishTeacher);
    await page.goto('/en/my-teaching');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'This week'
      })
    ).toBeVisible();

    const startLinks = page.getByRole('link', {
      name: 'Start update'
    });

    expect(await startLinks.count()).toBeGreaterThan(0);

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath(
        'en-teacher-this-week-desktop.png'
      ),
      fullPage: true
    });

    // English 360px queue.
    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/en/my-teaching');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'This week'
      })
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath(
        'en-teacher-this-week-mobile.png'
      ),
      fullPage: true
    });

    const firstStart = page
      .getByRole('link', {name: 'Start update'})
      .first();

    const englishUpdateHref =
      await firstStart.getAttribute('href');

    expect(englishUpdateHref).toBeTruthy();

    // English desktop weekly form.
    await page.setViewportSize({width: 1366, height: 900});
    await page.goto(englishUpdateHref!);

    await expect(
      page.getByRole('button', {name: 'Mark all present'})
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath(
        'en-teacher-weekly-update-desktop.png'
      ),
      fullPage: true
    });

    await page.setViewportSize({width: 360, height: 800});
    await page.goto(englishUpdateHref!);

    // English mobile weekly form.
    await expect(
      page.getByRole('button', {
        name: 'Mark all present'
      })
    ).toBeVisible();

    await page
      .getByRole('button', {name: 'Mark all present'})
      .click();

    const attendance = page.locator(
      '.attendance-list select'
    );

    const attendanceCount = await attendance.count();
    expect(attendanceCount).toBeGreaterThan(0);

    for (let i = 0; i < attendanceCount; i += 1) {
      await expect(attendance.nth(i)).toHaveValue('PRESENT');
    }

    await page
      .getByLabel('Default performance')
      .selectOption('GOOD');

    await page
      .getByLabel('What did you cover? (English)')
      .fill('Task 10 mobile workflow verification');

    const lastException = page
      .locator('.exception-toggle')
      .last();

    await lastException.scrollIntoViewIfNeeded();
    await lastException.click();

    await page
      .getByLabel('Performance override')
      .selectOption('EXCELLENT');

    await assertStickyDoesNotCoverLastStudent(page);
    await assertNoHorizontalOverflow(page);

    expect(
      await page.evaluate(
        () => document.activeElement?.classList.contains('skip-link') ?? false
      )
    ).toBe(false);

    await page.screenshot({
      path: testInfo.outputPath(
        'en-teacher-weekly-update-mobile.png'
      ),
      fullPage: true
    });

    // Explicit draft save.
    await page
      .getByRole('button', {name: 'Save draft'})
      .click();

    await expect(
      page.locator('.save-status')
    ).toContainText('Saved');

    // Queue now offers Continue draft for the same context.
    await page.goto('/en/my-teaching');

    const englishContextLink = page.locator(
      `a[href="${englishUpdateHref}"]`
    );

    await expect(englishContextLink).toHaveText(
      'Continue draft'
    );

    await englishContextLink.click();

    // Submit completes the workflow.
    await page
      .getByRole('button', {name: 'Submit'})
      .click();

    await expect(page).toHaveURL(/\/en\/history$/);

    await page.goto('/en/my-teaching');

    const submittedContextLink = page.locator(
      `a[href="${englishUpdateHref}"]`
    );

    await expect(submittedContextLink).toHaveText(
      'View submitted update'
    );

    await submittedContextLink.click();

    await expect(
      page.getByRole('button', {name: 'Save draft'})
    ).toHaveCount(0);

    await expect(
      page.getByRole('button', {name: 'Submit'})
    ).toHaveCount(0);

    await expect(
      page.locator('.weekly-form > .status-badge')
    ).toHaveText('Submitted');

    // Arabic Teacher.
    await clearSession(page);

    await page.setViewportSize({width: 1366, height: 900});
    await login(page, 'ar', credentials.arabicTeacher);
    await page.goto('/ar/my-teaching');

    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      'rtl'
    );

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'هذا الأسبوع'
      })
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath(
        'ar-teacher-this-week-desktop.png'
      ),
      fullPage: true
    });

    // Arabic 360px queue.
    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/ar/my-teaching');

    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      'rtl'
    );

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath(
        'ar-teacher-this-week-mobile.png'
      ),
      fullPage: true
    });

    const arabicStart = page
      .getByRole('link', {name: 'بدء التحديث'})
      .first();

    const arabicUpdateHref =
      await arabicStart.getAttribute('href');

    expect(arabicUpdateHref).toBeTruthy();

    // Arabic desktop weekly form.
    await page.setViewportSize({width: 1366, height: 900});
    await page.goto(arabicUpdateHref!);

    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      'rtl'
    );

    await expect(
      page.getByRole('button', {
        name: 'تحديد الجميع حاضرين'
      })
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath(
        'ar-teacher-weekly-update-desktop.png'
      ),
      fullPage: true
    });

    await page.setViewportSize({width: 360, height: 800});
    await page.goto(arabicUpdateHref!);

    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      'rtl'
    );

    await page
      .getByRole('button', {
        name: 'تحديد الجميع حاضرين'
      })
      .click();

    const arabicAttendance = page.locator(
      '.attendance-list select'
    );

    const arabicAttendanceCount =
      await arabicAttendance.count();

    expect(arabicAttendanceCount).toBeGreaterThan(0);

    for (
      let i = 0;
      i < arabicAttendanceCount;
      i += 1
    ) {
      await expect(
        arabicAttendance.nth(i)
      ).toHaveValue('PRESENT');
    }

    const arabicLastException = page
      .locator('.exception-toggle')
      .last();

    await arabicLastException.scrollIntoViewIfNeeded();
    await arabicLastException.click();

    await assertStickyDoesNotCoverLastStudent(page);
    await assertNoHorizontalOverflow(page);

    expect(
      await page.evaluate(
        () => document.activeElement?.classList.contains('skip-link') ?? false
      )
    ).toBe(false);

    await page.screenshot({
      path: testInfo.outputPath(
        'ar-teacher-weekly-update-mobile.png'
      ),
      fullPage: true
    });

    // Save an Arabic draft without relying on translated button text.
    await page
      .locator('button[name="intent"][value="draft"]')
      .click();

    await page.goto('/ar/my-teaching');

    const arabicContextLink = page.locator(
      `a[href="${arabicUpdateHref}"]`
    );

    await expect(arabicContextLink).toHaveText(
      'متابعة المسودة'
    );
  });
});
