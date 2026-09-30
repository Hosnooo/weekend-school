import {expect, type Page} from '@playwright/test';

import {schoolToday} from './redesign-fixtures';

export const credentials = {
  admin: {email: 'admin@example.test', password: 'WeekendSchool1!'},
  englishTeacher: {email: 'teacher.en@example.test', password: 'WeekendSchool1!'},
  arabicTeacher: {email: 'teacher.ar@example.test', password: 'WeekendSchool1!'}
};

export async function login(page: Page, locale: 'en' | 'ar', account: {email: string; password: string}) {
  await page.goto(`/${locale}/login`);
  await page.getByLabel(locale === 'ar' ? 'البريد الإلكتروني' : 'Email').fill(account.email);
  await page.getByLabel(locale === 'ar' ? 'كلمة المرور' : 'Password').fill(account.password);
  await page.getByRole('button', {name: locale === 'ar' ? 'تسجيل الدخول' : 'Sign in'}).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, {timeout: 60_000});
}

export async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.goto('/en/login');
  await page.evaluate(() => window.localStorage.clear());
}

export async function submitTeachingUpdate(page: Page, input: {
  locale: 'en' | 'ar';
  classSubjectId: string;
  subjectGroupId?: string;
  week: string;
  progressEn?: string;
  progressAr?: string;
  absentStudent?: string;
  exceptionStudent?: string;
}) {
  await page.goto(`/${input.locale}/my-teaching`);
  const row = page.locator('.teacher-new-update-row')
    .filter({has: page.locator(`input[name="classSubjectId"][value="${input.classSubjectId}"]`)})
    .filter({has: page.locator(`input[name="subjectGroupId"][value="${input.subjectGroupId ?? ''}"]`)});
  await expect(row).toBeVisible();
  await row.getByRole('button', {name: input.locale === 'ar' ? 'تحديث تدريس جديد' : 'New Teaching Update'}).click();
  await expect(page).toHaveURL(new RegExp(`/${input.locale}/my-teaching/update\\?submissionId=`));
  const submissionId = new URL(page.url()).searchParams.get('submissionId');
  expect(submissionId).toBeTruthy();
  const end = new Date(`${input.week}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  await page.locator('input[name="periodStart"]:visible').fill(input.week);
  await page.locator('input[name="periodEnd"]:visible').fill(
    end.toISOString().slice(0, 10) > schoolToday ? schoolToday : end.toISOString().slice(0, 10)
  );
  const markAll = page.getByRole('button', {name: input.locale === 'ar' ? 'تحديد الجميع حاضرين' : 'Mark all present'});
  await expect(markAll).toBeVisible();
  await markAll.click();
  if (input.absentStudent) {
    await page.getByRole('row', {name: new RegExp(input.absentStudent)}).locator('select').first().selectOption('ABSENT');
  }
  if (input.progressEn) await page.getByLabel(input.locale === 'ar' ? 'ماذا غطّيت؟ (بالإنجليزية)' : 'What did you cover? (English)').fill(input.progressEn);
  if (input.progressAr) await page.getByLabel(input.locale === 'ar' ? 'ماذا غطّيت؟ (بالعربية)' : 'What did you cover? (Arabic)').fill(input.progressAr);
  await page.getByLabel(input.locale === 'ar' ? 'الأداء الافتراضي' : 'Default performance').selectOption('GOOD');
  if (input.exceptionStudent) {
    await page.getByRole('row', {name: new RegExp(input.exceptionStudent)}).locator('select').nth(1).selectOption('EXCELLENT');
  }
  await page.getByRole('button', {name: input.locale === 'ar' ? 'حفظ التحديث' : 'Save update'}).click();
  await expect(page.locator('.save-status')).toContainText(input.locale === 'ar' ? 'تم الحفظ' : 'Saved');
  const submit = page.getByRole('button', {name: input.locale === 'ar' ? 'إرسال التحديث' : 'Submit update'});
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(new RegExp(`/${input.locale}/history$`));
  return `/${input.locale}/history/${submissionId}`;
}
