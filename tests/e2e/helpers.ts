import {expect, type Page} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';

export const credentials = {
  admin: {email: 'admin@example.test', password: 'WeekendSchool1!'},
  englishTeacher: {email: 'teacher.en@example.test', password: 'WeekendSchool1!'},
  arabicTeacher: {email: 'teacher.ar@example.test', password: 'WeekendSchool1!'}
};

export async function login(
  page: Page,
  locale: 'en' | 'ar',
  account: {email: string; password: string}
) {
  await page.goto(`/${locale}/login`);
  await page.getByLabel(locale === 'ar' ? 'البريد الإلكتروني' : 'Email').fill(account.email);
  await page.getByLabel(locale === 'ar' ? 'كلمة المرور' : 'Password').fill(account.password);
  await page.getByRole('button', {name: locale === 'ar' ? 'تسجيل الدخول' : 'Sign in'}).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.goto('/en/login');
  await page.evaluate(() => window.localStorage.clear());
}

export async function setInvitedUserPassword(email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('E2E requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const client = createClient(url, key, {auth: {autoRefreshToken: false, persistSession: false}});
  const {data, error} = await client.auth.admin.listUsers({page: 1, perPage: 1000});
  if (error) throw error;
  const user = data.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error(`Invited user not found: ${email}`);
  const {error: updateError} = await client.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true
  });
  if (updateError) throw updateError;
}

export async function openReportPeriod(page: Page, locale: 'en' | 'ar', month: string) {
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
    .getUTCDate()
    .toString()
    .padStart(2, '0');
  await page.goto(`/${locale}/reports?periodStart=${month}-01&periodEnd=${month}-${lastDay}`);
}
