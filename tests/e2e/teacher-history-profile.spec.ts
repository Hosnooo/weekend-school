import {expect, test, type Page} from '@playwright/test';

import {redesign} from './redesign-fixtures';
import {
  clearSession,
  credentials,
  login,
  submitTeachingUpdate
} from './helpers';

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );

  expect(overflow).toBeLessThanOrEqual(1);
}

async function assertReadOnlyHistoryDetail(
  page: Page,
  locale: 'en' | 'ar'
) {
  await expect(
    page.locator('.weekly-form > .status-badge')
  ).toHaveText(locale === 'ar' ? 'تم الإرسال' : 'Submitted');

  await expect(
    page.locator('button[name="intent"][value="draft"]')
  ).toHaveCount(0);

  await expect(
    page.locator('button[name="intent"][value="submit"]')
  ).toHaveCount(0);
}

test.describe('Teacher History and Profile', () => {
  test('renders submitted History and read-only Profile surfaces in EN/AR', async ({
    page
  }, testInfo) => {
    // ---------- English ----------
    await login(page, 'en', credentials.englishTeacher);

    await submitTeachingUpdate(page, {
      locale: 'en',
      classSubjectId: redesign.wholeClassSubjectId,
      week: '2031-06-02',
      progressEn: 'Task 11 English history verification'
    });

    // History desktop.
    await page.setViewportSize({width: 1366, height: 900});
    await page.goto('/en/history');

    await expect(
      page.getByRole('heading', {level: 1, name: 'History'})
    ).toBeVisible();

    await expect(
      page.getByText('Submitted', {exact: true}).first()
    ).toBeVisible();

    await expect(
      page.getByText('Foundations', {exact: true}).first()
    ).toBeVisible();

    await expect(
      page.getByText('Faith & Character', {exact: true}).first()
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-history-desktop.png'),
      fullPage: true
    });

    const englishDetailHref = await page
      .getByRole('link', {name: 'View'})
      .first()
      .getAttribute('href');

    expect(englishDetailHref).toBeTruthy();

    // History detail desktop.
    await page.goto(englishDetailHref!);

    await assertReadOnlyHistoryDetail(page, 'en');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-history-detail-desktop.png'),
      fullPage: true
    });

    // Profile desktop.
    await page.goto('/en/profile');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'My Profile'
      })
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {name: 'Login identity'})
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {name: 'Teacher records'})
    ).toBeVisible();

    await expect(
      page.getByText('Active', {exact: true})
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-profile-desktop.png'),
      fullPage: true
    });

    // English mobile History.
    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/en/history');

    await expect(
      page.getByRole('heading', {level: 1, name: 'History'})
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-history-mobile.png'),
      fullPage: true
    });

    // English mobile detail.
    await page.goto(englishDetailHref!);

    await assertReadOnlyHistoryDetail(page, 'en');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-history-detail-mobile.png'),
      fullPage: true
    });

    // English mobile Profile.
    await page.goto('/en/profile');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'My Profile'
      })
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('en-profile-mobile.png'),
      fullPage: true
    });

    // Legacy redirect.
    await page.goto('/en/my-groups');
    await expect(page).toHaveURL(/\/en\/my-teaching$/);

    // ---------- Arabic ----------
    await clearSession(page);

    await login(page, 'ar', credentials.arabicTeacher);

    await submitTeachingUpdate(page, {
      locale: 'ar',
      classSubjectId: redesign.groupedSubjectId,
      subjectGroupId: redesign.blueGroupId,
      week: '2031-07-07',
      progressAr: 'تحقق السجل للمهمة 11'
    });

    // Arabic History desktop.
    await page.setViewportSize({width: 1366, height: 900});
    await page.goto('/ar/history');

    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      'rtl'
    );

    await expect(
      page.getByRole('heading', {level: 1, name: 'السجل'})
    ).toBeVisible();

    await expect(
      page.getByText('تم الإرسال', {exact: true}).first()
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-history-desktop.png'),
      fullPage: true
    });

    const arabicDetailHref = await page
      .getByRole('link', {name: 'عرض'})
      .first()
      .getAttribute('href');

    expect(arabicDetailHref).toBeTruthy();

    // Arabic History detail desktop.
    await page.goto(arabicDetailHref!);

    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      'rtl'
    );

    await assertReadOnlyHistoryDetail(page, 'ar');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-history-detail-desktop.png'),
      fullPage: true
    });

    // Arabic Profile desktop.
    await page.goto('/ar/profile');

    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      'rtl'
    );

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'ملفي الشخصي'
      })
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {name: 'هوية الدخول'})
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {name: 'سجلات المعلم'})
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-profile-desktop.png'),
      fullPage: true
    });

    // Arabic mobile History.
    await page.setViewportSize({width: 360, height: 800});
    await page.goto('/ar/history');

    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      'rtl'
    );

    await expect(
      page.getByRole('heading', {level: 1, name: 'السجل'})
    ).toBeVisible();

    await expect(
      page.getByText('تم الإرسال', {exact: true}).first()
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-history-mobile.png'),
      fullPage: true
    });

    // Arabic mobile detail.
    await page.goto(arabicDetailHref!);

    await assertReadOnlyHistoryDetail(page, 'ar');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-history-detail-mobile.png'),
      fullPage: true
    });

    // Arabic mobile Profile.
    await page.goto('/ar/profile');

    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      'rtl'
    );

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'ملفي الشخصي'
      })
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath('ar-profile-mobile.png'),
      fullPage: true
    });

    // Arabic legacy redirect preserves locale.
    await page.goto('/ar/my-groups');
    await expect(page).toHaveURL(/\/ar\/my-teaching$/);
  });
});
