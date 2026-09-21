import {expect, test} from '@playwright/test';

import {clearSession, credentials, login, openReportPeriod, setInvitedUserPassword} from './helpers';

test('English administrator-to-report workflow', async ({page}) => {
  const token = Date.now().toString();
  const teacherName = `Flow Teacher ${token}`;
  const teacherEmail = `flow-${token}@example.test`;
  const teacherPassword = 'WeekendSchool1!';
  const groupName = `Flow Group ${token}`;
  const studentName = `FlowStudent${token}`;

  await login(page, 'en', credentials.admin);

  await page.goto('/en/teachers/new');
  await page.getByLabel('Display name').fill(teacherName);
  await page.getByLabel('Email address').fill(teacherEmail);
  await page.getByRole('button', {name: 'Save'}).click();
  await expect(page).toHaveURL(/\/en\/teachers$/);

  await page.goto('/en/groups/new');
  await page.getByLabel('Group name (English)').fill(groupName);
  await page.getByLabel('Primary teacher').selectOption({label: teacherName});
  await page.getByRole('button', {name: 'Save'}).click();
  await expect(page).toHaveURL(/\/en\/groups$/);

  await page.goto('/en/students/new');
  await page.getByLabel('First name (English)').fill(studentName);
  await page.getByLabel('Last name (English)').fill('Example');
  await page.getByLabel('Guardian name').fill('Flow Guardian');
  await page.getByLabel('Guardian email').fill(`guardian-${token}@example.test`);
  await page.getByLabel('Current group').selectOption({label: groupName});
  await page.getByRole('button', {name: 'Save'}).click();
  await expect(page).toHaveURL(/\/en\/students$/);

  await setInvitedUserPassword(teacherEmail, teacherPassword);
  await clearSession(page);
  await login(page, 'en', {email: teacherEmail, password: teacherPassword});
  await page.setViewportSize({width: 360, height: 800});
  await page.goto('/en/my-groups');
  const groupCard = page.getByRole('heading', {name: groupName}).locator('..');
  const updateHref = await groupCard.getByRole('link', {name: 'Update this week'}).getAttribute('href');
  expect(updateHref).toBeTruthy();
  await page.goto(`${updateHref!.split('?')[0]}?date=2030-01-12`);
  await page.getByRole('button', {name: 'Mark all present'}).click();
  await page.getByLabel('What did the group cover? (English)').fill('English end-to-end lesson');
  await page.getByLabel('Default performance').selectOption('GOOD');
  await page.getByRole('button', {name: 'Submit'}).click();
  await expect(page).toHaveURL(/\/en\/history$/);

  await clearSession(page);
  await page.setViewportSize({width: 1280, height: 800});
  await login(page, 'en', credentials.admin);
  await openReportPeriod(page, 'en', '2030-01');
  await page.getByRole('button', {name: 'Generate reports'}).click();
  const reportRow = page.getByRole('row', {name: new RegExp(studentName)});
  await expect(reportRow).toBeVisible();
  await reportRow.getByRole('link', {name: 'Preview'}).click();
  await expect(page.frameLocator('iframe[title="Report preview"]').getByText('English end-to-end lesson')).toBeVisible();
});
