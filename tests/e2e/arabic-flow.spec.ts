import {expect, test} from '@playwright/test';

import {redesign} from './redesign-fixtures';
import {clearSession, credentials, login, submitTeachingUpdate} from './helpers';

test('Arabic RTL teaching and report workflow uses the redesigned Group context', async ({page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await login(page, 'ar', credentials.arabicTeacher);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    page.getByRole('heading', {level: 1, name: 'تحديثات التدريس'})
  ).toBeVisible();
  await submitTeachingUpdate(page, {
    locale: 'ar',
    classSubjectId: redesign.groupedSubjectId,
    subjectGroupId: redesign.blueGroupId,
    week: redesign.arabicWeek,
    progressAr: 'تدربنا على القراءة العربية'
  });

  await clearSession(page);
  await page.setViewportSize({width: 1280, height: 800});
  await login(page, 'ar', credentials.admin);
  await page.goto('/ar/reports');
  const createCycle = page.locator('details.report-cycle-create');
  await createCycle.locator('summary').click();
  await createCycle.locator('select[name="classId"]').selectOption(redesign.classId);
  await createCycle.locator('input[name="periodStart"]').fill(redesign.arabicWeek);
  await createCycle.locator('input[name="periodEnd"]').fill('2026-09-21');
  await createCycle.getByRole('button', {name: 'إنشاء دورة تقارير'}).click();
  await expect(page.getByRole('heading', {level: 1})).toContainText('دورة التقارير');
  await expect(page.locator('.report-source-row').filter({hasText: 'الأزرق'})).toHaveCount(1);
  await page.getByRole('button', {name: 'إنشاء تقارير الطلاب'}).click();
  const report = page.locator('.report-cycle-report-list article').filter({hasText: 'عمر حسن'});
  await report.getByRole('link', {name: 'معاينة التقرير'}).click();
  const frame = page.frameLocator('iframe[title="معاينة التقرير"]');
  await expect(frame.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(frame.getByText('تدربنا على القراءة العربية')).toBeVisible();
});
