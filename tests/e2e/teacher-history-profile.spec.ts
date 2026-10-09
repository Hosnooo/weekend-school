import {expect, test, type Page} from '@playwright/test';

import {clearSession, credentials, login} from './helpers';
import {redesign} from './redesign-fixtures';

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

const cases = [
  {
    locale: 'en' as const,
    account: credentials.englishTeacher,
    history: 'History', profile: 'My account', loginIdentity: 'Sign-in email', teacherRecords: 'Linked Teacher records',
    newUpdate: 'New Teaching Update', selectedDates: 'Selected dates', markAll: 'Mark all present',
    progress: 'What did you cover? (English)', performance: 'Default performance',
    save: 'Save update', submit: 'Submit update', view: 'View', reopen: 'Reopen and edit'
  },
  {
    locale: 'ar' as const,
    account: credentials.arabicTeacher,
    history: 'السجل', profile: 'حسابي', loginIdentity: 'البريد الإلكتروني لتسجيل الدخول', teacherRecords: 'سجلات المعلم المرتبطة',
    newUpdate: 'تحديث تدريس جديد', selectedDates: 'تواريخ محددة', markAll: 'تحديد الجميع حاضرين',
    progress: 'ماذا غطّيت؟ (بالعربية)', performance: 'الأداء الافتراضي',
    save: 'حفظ التحديث', submit: 'إرسال التحديث', view: 'عرض', reopen: 'إعادة الفتح والتعديل'
  }
];

for (const item of cases) {
  test(`submitted Teaching Update History and Profile ${item.locale} desktop and 360px`, async ({page}, testInfo) => {
    test.setTimeout(180_000);
    await page.setViewportSize({width: 1366, height: 900});
    await login(page, item.locale, item.account);
    await page.goto(`/${item.locale}/my-teaching`);
    await page.locator('.teacher-new-update-row').filter({
      has: page.locator(`input[name="classSubjectId"][value="${redesign.groupedSubjectId}"]`)
    }).first().getByRole('button', {name: item.newUpdate}).click();
    await page.getByRole('radio', {name: item.selectedDates}).check();
    await page.getByRole('button', {name: item.markAll}).click();
    await page.getByLabel(item.progress).fill(`History verification ${item.locale}`);
    await page.getByLabel(item.performance).selectOption('GOOD');
    await page.getByRole('button', {name: item.save}).click();
    await expect(page.locator('.save-status')).toBeVisible();
    await page.getByRole('button', {name: item.submit}).click();
    await expect(page).toHaveURL(new RegExp(`/${item.locale}/history$`));

    await expect(page.getByRole('heading', {level: 1, name: item.history})).toBeVisible();
    await expect(page.getByText(item.selectedDates, {exact: false}).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath(`${item.locale}-history-desktop.png`), fullPage: true});

    const detailHref = await page.getByRole('link', {name: item.view}).first().getAttribute('href');
    expect(detailHref).toBeTruthy();
    await page.goto(detailHref!);
    await expect(page.getByRole('radio', {name: item.selectedDates})).toBeChecked();
    await expect(page.getByRole('radio', {name: item.selectedDates})).toBeDisabled();
    await expect(page.getByRole('button', {name: item.save})).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath(`${item.locale}-history-detail-desktop.png`), fullPage: true});

    await page.goto(`/${item.locale}/account`);
    await expect(page.getByRole('heading', {level: 1, name: item.profile})).toBeVisible();
    await expect(page.getByRole('heading', {name: item.loginIdentity})).toBeVisible();
    await expect(page.getByRole('heading', {name: item.teacherRecords})).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath(`${item.locale}-profile-desktop.png`), fullPage: true});

    await page.setViewportSize({width: 360, height: 800});
    await page.goto(`/${item.locale}/history`);
    await expect(page.getByRole('heading', {level: 1, name: item.history})).toBeVisible();
    await expect(page.getByText(item.selectedDates, {exact: false}).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath(`${item.locale}-history-mobile.png`), fullPage: true});
    await page.goto(detailHref!);
    await expect(page.getByRole('radio', {name: item.selectedDates})).toBeChecked();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath(`${item.locale}-history-detail-mobile.png`), fullPage: true});
    await page.goto(`/${item.locale}/account`);
    await expect(page.getByRole('heading', {level: 1, name: item.profile})).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path: testInfo.outputPath(`${item.locale}-profile-mobile.png`), fullPage: true});
    await page.goto(detailHref!);
    await page.getByRole('button', {name: item.reopen}).click();
    await expect(page).toHaveURL(new RegExp(`/${item.locale}/my-teaching/update\\?submissionId=`));
    await expect(page.getByRole('button', {name: item.save})).toBeVisible();
    await page.goto(`/${item.locale}/my-groups`);
    await expect(page).toHaveURL(new RegExp(`/${item.locale}/my-teaching$`));
    await clearSession(page);
  });
}
