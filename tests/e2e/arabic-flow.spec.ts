import {expect, test} from '@playwright/test';

import {redesign} from './redesign-fixtures';
import {clearSession, credentials, login, submitTeachingUpdate} from './helpers';

test('Arabic RTL teaching and report workflow uses the redesigned Group context', async ({page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await login(page, 'ar', credentials.arabicTeacher);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('link', {name: 'تدريسي'})).toHaveAttribute('aria-current', 'page');
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
  await page.getByLabel('بداية الفترة').fill('2030-02-04');
  await page.getByLabel('نهاية الفترة').fill('2030-02-10');
  await page.locator('select[name="classId"]').selectOption(redesign.classId);
  await page.locator('select[name="scopeType"]').selectOption('GROUP');
  await page.locator('select[name="classSubjectId"]').selectOption(redesign.groupedSubjectId);
  await page.locator('select[name="subjectGroupId"]').selectOption(redesign.blueGroupId);
  await page.getByRole('button', {name: 'إعداد دفعة تقارير'}).click();
  await expect(page.getByRole('heading', {name: 'مراجعة الدفعة'})).toBeVisible();
  await expect(page.getByText('تدربنا على القراءة العربية')).toBeVisible();
  await page.getByRole('button', {name: 'استخدام كل المصادر المرسلة'}).click();
  await page.getByRole('button', {name: 'الانتقال إلى المراجعة'}).click();
  await page.getByRole('button', {name: 'اعتماد التقارير نهائيًا'}).click();
  const row = page.getByRole('row', {name: /عمر حسن.*العربية/});
  await row.getByRole('link', {name: 'معاينة'}).click();
  const frame = page.frameLocator('iframe[title="معاينة التقرير"]');
  await expect(frame.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(frame.getByText('تدربنا على القراءة العربية')).toBeVisible();
});
