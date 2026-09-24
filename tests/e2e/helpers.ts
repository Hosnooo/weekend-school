import {expect, type Page} from '@playwright/test';

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
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
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
  const query = new URLSearchParams({classSubjectId: input.classSubjectId, week: input.week});
  if (input.subjectGroupId) query.set('subjectGroupId', input.subjectGroupId);
  await page.goto(`/${input.locale}/my-teaching/update?${query}`);
  const markAll = page.getByRole('button', {name: input.locale === 'ar' ? 'تحديد الجميع حاضرين' : 'Mark all present'});
  await expect(markAll).toBeVisible();
  await markAll.click();
  if (input.absentStudent) {
    await page.locator('label').filter({hasText: input.absentStudent}).locator('select').selectOption('ABSENT');
  }
  if (input.progressEn) await page.getByLabel(input.locale === 'ar' ? 'ماذا غطّيت؟ (بالإنجليزية)' : 'What did you cover? (English)').fill(input.progressEn);
  if (input.progressAr) await page.getByLabel(input.locale === 'ar' ? 'ماذا غطّيت؟ (بالعربية)' : 'What did you cover? (Arabic)').fill(input.progressAr);
  await page.getByLabel(input.locale === 'ar' ? 'الأداء الافتراضي' : 'Default performance').selectOption('GOOD');
  if (input.exceptionStudent) {
    await page.getByRole('button', {name: input.exceptionStudent}).click();
    await page.getByLabel(input.locale === 'ar' ? 'استثناء الأداء' : 'Performance override').selectOption('EXCELLENT');
  }
  await page.getByRole('button', {name: input.locale === 'ar' ? 'إرسال' : 'Submit'}).click();
  await expect(page).toHaveURL(new RegExp(`/${input.locale}/history$`));
}
