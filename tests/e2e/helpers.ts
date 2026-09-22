import {expect, type Page} from '@playwright/test';

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

export async function acceptTeacherInvitation(page:Page,email:string,password:string) {
  let invitationUrl='';
  await expect.poll(async()=>{const listResponse=await fetch('http://127.0.0.1:54324/api/v1/messages');if(!listResponse.ok)return false;const list=await listResponse.json() as {messages:Array<{ID:string;To:Array<{Address:string}>}>};const latest=list.messages.find(({To})=>To.some(({Address})=>Address===email));if(!latest)return false;const messageResponse=await fetch(`http://127.0.0.1:54324/api/v1/message/${latest.ID}`);if(!messageResponse.ok)return false;const message=await messageResponse.json() as {HTML?:string;Text?:string};const body=`${message.HTML??''}\n${message.Text??''}`.replaceAll('&amp;','&');invitationUrl=body.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/)?.[0]??'';return Boolean(invitationUrl)},{timeout:10_000,message:'invitation email should arrive in local Mailpit'}).toBe(true);
  await page.goto(invitationUrl);
  await expect(page).toHaveURL(/\/en\/set-password/);
  await page.getByLabel('New password').fill(password);
  await page.getByRole('button',{name:'Set password'}).click();
  await expect(page).toHaveURL(/\/en\/my-groups/);
}

export async function openReportPeriod(page: Page, locale: 'en' | 'ar', month: string) {
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
    .getUTCDate()
    .toString()
    .padStart(2, '0');
  await page.goto(`/${locale}/reports?periodStart=${month}-01&periodEnd=${month}-${lastDay}`);
}
