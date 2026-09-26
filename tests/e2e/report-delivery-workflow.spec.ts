import {expect, test, type Page} from '@playwright/test';

import {credentials, login} from './helpers';

const period =
  'periodStart=2026-09-01&periodEnd=2026-09-30';

const englishReportId =
  '70000000-0000-0000-0000-000000000001';

const arabicReportId =
  '70000000-0000-0000-0000-000000000002';

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );

  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('Reports and Delivery Status', () => {
  test(
    'renders staged reports, preview, and delivery filters in EN/AR',
    async ({page}, testInfo) => {
      await page.setViewportSize({width: 1366, height: 900});
      await login(page, 'en', credentials.admin);

      // English Reports — desktop.
      await page.goto(`/en/reports?${period}`);

      await expect(
        page.getByRole('heading', {level: 1, name: 'Reports'})
      ).toBeVisible();

      for (const name of ['Prepare', 'Review', 'Finalize', 'Send']) {
        await expect(
          page.getByRole('tab', {name, exact: true})
        ).toBeVisible();
      }

      await expect(
        page.getByRole('button', {
          name: 'Send ready reports'
        })
      ).toBeVisible();

      await expect(
        page.getByText('Sara Ali', {exact: true})
      ).toBeVisible();

      await expect(
        page.getByText('Omar Hassan', {exact: true})
      ).toBeVisible();

      await expect(
        page.getByText('Lina Khalil', {exact: true})
      ).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: 'View delivery status'
        })
      ).toHaveAttribute(
        'href',
        '/en/reports/delivery-status'
      );

      await page.getByRole('tab', {
        name: 'Review',
        exact: true
      }).click();

      await expect(
        page.getByText(
          'Review submitted teaching sources and approve the content to use.',
          {exact: true}
        )
      ).toBeVisible();

      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath('en-reports-desktop.png'),
        fullPage: true
      });

      // English Delivery Status — desktop.
      await page.goto('/en/reports/delivery-status');

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Delivery status'
        })
      ).toBeVisible();

      for (const name of ['All', 'Pending', 'Sent', 'Failed']) {
        await expect(
          page.getByRole('link', {name, exact: true})
        ).toBeVisible();
      }

      await expect(
        page.getByText('Sara Ali', {exact: true})
      ).toBeVisible();

      await expect(
        page.getByText('Omar Hassan', {exact: true})
      ).toBeVisible();

      await expect(
        page.getByText('Lina Khalil', {exact: true})
      ).toBeVisible();

      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath(
          'en-delivery-status-desktop.png'
        ),
        fullPage: true
      });

      // Failed filter must isolate the failed delivery.
      await page.goto(
        '/en/reports/delivery-status?status=FAILED'
      );

      await expect(
        page.getByText('Lina Khalil', {exact: true})
      ).toBeVisible();

      await expect(
        page.getByText('Test delivery failure', {exact: true})
      ).toBeVisible();

      await expect(
        page.getByText('Sara Ali', {exact: true})
      ).toHaveCount(0);

      // English Preview — desktop.
      await page.goto(`/en/reports/${englishReportId}`);

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Report preview'
        })
      ).toBeVisible();

      await expect(page.locator('iframe.report-preview')).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: 'View delivery status'
        })
      ).toBeVisible();

      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath(
          'en-report-preview-desktop.png'
        ),
        fullPage: true
      });

      // English mobile.
      await page.setViewportSize({width: 360, height: 800});

      await page.goto(`/en/reports?${period}`);

      await expect(
        page.getByRole('heading', {level: 1, name: 'Reports'})
      ).toBeVisible();

      await expect(
        page.getByText('Lina Khalil', {exact: true})
      ).toBeVisible();

      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath('en-reports-mobile.png'),
        fullPage: true
      });

      await page.goto('/en/reports/delivery-status');

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Delivery status'
        })
      ).toBeVisible();

      await expect(
        page.getByText('Lina Khalil', {exact: true})
      ).toBeVisible();

      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath(
          'en-delivery-status-mobile.png'
        ),
        fullPage: true
      });

      await page.goto(`/en/reports/${englishReportId}`);

      await expect(page.locator('iframe.report-preview')).toBeVisible();
      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath(
          'en-report-preview-mobile.png'
        ),
        fullPage: true
      });

      // Arabic Reports — desktop.
      await page.setViewportSize({width: 1366, height: 900});
      await page.goto(`/ar/reports?${period}`);

      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        'rtl'
      );

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'التقارير'
        })
      ).toBeVisible();

      for (const name of [
        'الإعداد',
        'المراجعة',
        'الاعتماد النهائي',
        'الإرسال'
      ]) {
        await expect(
          page.getByRole('tab', {name, exact: true})
        ).toBeVisible();
      }

      await expect(
        page.getByText('سارة علي', {exact: true})
      ).toBeVisible();

      await expect(
        page.getByText('عمر حسن', {exact: true})
      ).toBeVisible();

      await expect(
        page.getByText('لينا خليل', {exact: true})
      ).toBeVisible();

      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath('ar-reports-desktop.png'),
        fullPage: true
      });

      // Arabic Delivery Status — desktop.
      await page.goto('/ar/reports/delivery-status');

      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        'rtl'
      );

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'حالة التسليم'
        })
      ).toBeVisible();

      for (const name of [
        'الكل',
        'معلق',
        'تم الإرسال',
        'فشل'
      ]) {
        await expect(
          page.getByRole('link', {name, exact: true})
        ).toBeVisible();
      }

      await expect(
        page.getByText('لينا خليل', {exact: true})
      ).toBeVisible();

      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath(
          'ar-delivery-status-desktop.png'
        ),
        fullPage: true
      });

      // Arabic Preview — desktop.
      await page.goto(`/ar/reports/${arabicReportId}`);

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'معاينة التقرير'
        })
      ).toBeVisible();

      await expect(page.locator('iframe.report-preview')).toBeVisible();

      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath(
          'ar-report-preview-desktop.png'
        ),
        fullPage: true
      });

      // Arabic mobile.
      await page.setViewportSize({width: 360, height: 800});

      await page.goto(`/ar/reports?${period}`);

      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        'rtl'
      );

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'التقارير'
        })
      ).toBeVisible();

      await expect(
        page.getByText('لينا خليل', {exact: true})
      ).toBeVisible();

      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath('ar-reports-mobile.png'),
        fullPage: true
      });

      await page.goto('/ar/reports/delivery-status');

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'حالة التسليم'
        })
      ).toBeVisible();

      await expect(
        page.getByText('لينا خليل', {exact: true})
      ).toBeVisible();

      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath(
          'ar-delivery-status-mobile.png'
        ),
        fullPage: true
      });

      await page.goto(`/ar/reports/${arabicReportId}`);

      await expect(page.locator('iframe.report-preview')).toBeVisible();
      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath(
          'ar-report-preview-mobile.png'
        ),
        fullPage: true
      });
    }
  );
});
