import {expect, test, type Page} from '@playwright/test';

import {clearSession, credentials, login} from './helpers';

type Locale = 'en' | 'ar';

async function verifyKeyboardNavigation(
  page: Page,
  locale: Locale,
  account: typeof credentials.admin
) {
  await page.setViewportSize({width: 360, height: 800});
  await clearSession(page);
  await login(page, locale, account);
  await page.goto(`/${locale}/${account === credentials.admin ? 'dashboard' : 'my-teaching'}`);

  const trigger = page.locator('button[aria-haspopup="dialog"]').first();
  await expect(trigger).toBeVisible();

  await trigger.focus();
  await expect(trigger).toBeFocused();

  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  const focusedInsideDialog = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return Boolean(dialog && dialog.contains(document.activeElement));
  });
  expect(focusedInsideDialog).toBe(true);

  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

for (const locale of ['en', 'ar'] as const) {
  test(`mobile Administrator navigation is keyboard-safe in ${locale}`, async ({
    page
  }) => {
    await verifyKeyboardNavigation(page, locale, credentials.admin);
  });

  test(`mobile Teacher navigation is keyboard-safe in ${locale}`, async ({
    page
  }) => {
    await verifyKeyboardNavigation(page, locale, credentials.englishTeacher);
  });

  test(`School Settings controls have accessible names in ${locale}`, async ({
    page
  }) => {
    await clearSession(page);
    await login(page, locale, credentials.admin);
    await page.goto(`/${locale}/settings`);

    await expect(page.locator('input[name="nameEn"]')).toHaveAccessibleName(/.+/);
    await expect(page.locator('input[name="nameAr"]')).toHaveAccessibleName(/.+/);
    await expect(page.locator('input[name="timezone"]')).toHaveAccessibleName(/.+/);
    await expect(
      page.locator('select[name="defaultLanguage"]')
    ).toHaveAccessibleName(/.+/);

    const settingsForm = page.locator('form.record-form');

    await expect(
      settingsForm.locator('button[type="submit"]')
    ).toHaveAccessibleName(/.+/);

    await expect(
      settingsForm.locator('button[type="reset"]')
    ).toHaveAccessibleName(/.+/);
  });
}
