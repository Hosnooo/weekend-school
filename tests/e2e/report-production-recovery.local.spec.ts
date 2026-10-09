import {readFileSync} from 'node:fs';
import {expect, test} from '@playwright/test';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const credentialsFile = process.env.REPORT_RECOVERY_CREDENTIAL_FILE;
if (url !== 'http://127.0.0.1:56421' || !credentialsFile) {
  throw new Error('Refusing browser verification outside the disposable Supabase stack');
}
const fixture = JSON.parse(readFileSync(credentialsFile, 'utf8')) as {
  admin: {email: string; password: string};
  teacher: {email: string; password: string};
  batchId: string;
};
const marker = 'LOCAL_DISPOSABLE_AUTH_UI_CHECK';

async function signIn(page: import('@playwright/test').Page, account: {
  email: string; password: string
}) {
  await page.goto('/en/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', {name: 'Sign in'}).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, {timeout: 60_000});
}

test('restored Administrator signs in, saves a real draft edit, reloads and previews the bilingual guardian email', async ({page}) => {
  await signIn(page, fixture.admin);
  await page.goto('/en/reports/workspace/' + fixture.batchId);
  const edit = page.getByRole('link', {name: 'Edit update'}).first();
  await expect(edit).toBeVisible();
  await edit.click();
  const editor = page.locator('.report-source-editor:visible').first();
  await expect(editor).toBeVisible();
  const studentId = await editor.locator('input[name="studentId"]').first().inputValue();
  expect(studentId).toBeTruthy();
  const sharedEnglish = editor.locator('textarea[name="mainReportEn"]');
  const original = await sharedEnglish.inputValue();
  const next = [original, marker].filter(Boolean).join('\n');
  await sharedEnglish.fill(next);
  await editor.getByRole('button', {name: 'Save & close'}).click();
  await expect(editor).toBeHidden({timeout: 30_000});

  await page.reload();
  const reopened = page.getByRole('link', {name: 'Edit update'}).first();
  await reopened.click();
  const persisted = page.locator('.report-source-editor:visible').first();
  await expect(persisted.locator('textarea[name="mainReportEn"]')).toHaveValue(next);
  await persisted.getByRole('button', {name: 'Cancel'}).click();

  const email = page.locator('section.report-email-review-panel');
  await expect(email).toBeVisible();
  const select = email.locator('select');
  expect(await select.locator('option').count()).toBeGreaterThan(1);
  await select.selectOption(studentId);
  const frame = email.locator('iframe.report-preview');
  await expect(frame).toHaveAttribute('srcdoc', new RegExp(marker), {timeout: 60_000});
  expect(await frame.getAttribute('srcdoc')).toContain(marker);
  console.log('PASS: Restored Admin browser save, reload and bilingual email-preview smoke.');
});

test('restored Teacher-only identity cannot edit Administrator report cycles', async ({page}) => {
  await signIn(page, fixture.teacher);
  await page.goto('/en/reports/workspace/' + fixture.batchId);
  await expect(page.getByRole('link', {name: 'Edit update'})).toHaveCount(0);
  console.log('PASS: Restored Teacher-only browser identity cannot open Admin report editor.');
});
