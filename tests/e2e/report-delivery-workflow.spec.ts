import {createClient} from '@supabase/supabase-js';
import {expect, test, type Page} from '@playwright/test';

import {credentials, login} from './helpers';

const period =
  'periodStart=2026-09-01&periodEnd=2026-09-30';

const englishReportId =
  '70000000-0000-0000-0000-000000000001';

const arabicReportId =
  '70000000-0000-0000-0000-000000000002';

const failedReportId =
  '70000000-0000-0000-0000-000000000003';

const schoolId =
  'a0000000-0000-0000-0000-000000000001';

const reportFixtureIds = [
  englishReportId,
  arabicReportId,
  failedReportId
];

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Local Supabase service credentials are required for report E2E setup.'
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function reportSnapshot(
  studentId: string,
  nameEn: string,
  nameAr: string,
  language: 'en' | 'ar' | 'both'
) {
  return {
    version: 1,
    school: {
      nameEn: 'Weekend School',
      nameAr: 'مدرسة نهاية الأسبوع'
    },
    student: {
      id: studentId,
      nameEn,
      nameAr
    },
    period: {
      start: '2026-09-01',
      end: '2026-09-30'
    },
    language,
    groups: [],
    attendance: {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      sessions: 0
    },
    progress: [],
    currentPerformance: 'GOOD',
    comments: [],
    generatedAt: '2026-09-30T18:00:00.000Z'
  };
}

async function cleanupReportFixtures() {
  const supabase = serviceClient();

  const {error: deliveryError} = await supabase
    .from('email_deliveries')
    .delete()
    .in('report_id', reportFixtureIds);

  if (deliveryError) throw deliveryError;

  const {error: reportError} = await supabase
    .from('reports')
    .delete()
    .in('id', reportFixtureIds);

  if (reportError) throw reportError;
}

async function assertNoHorizontalOverflow(page: Page) {
  const {overflow, offenders} = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll('*')]
      .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(-12)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className} ${Math.round(element.getBoundingClientRect().right)}px`)
  }));

  expect(overflow, offenders.join(', ')).toBeLessThanOrEqual(1);
}

test.describe('Reports and Delivery Status', () => {
  test.beforeAll(async () => {
    const supabase = serviceClient();

    await cleanupReportFixtures();

    const {error: reportError} = await supabase
      .from('reports')
      .insert([
        {
          id: englishReportId,
          school_id: schoolId,
          student_id: 'e0000000-0000-0000-0000-000000000001',
          period_start: '2026-09-01',
          period_end: '2026-09-30',
          language: 'en',
          status: 'SENT',
          snapshot_json: reportSnapshot(
            'e0000000-0000-0000-0000-000000000001',
            'Sara Ali',
            'سارة علي',
            'en'
          ),
          generated_at: '2026-09-30T18:00:00.000Z',
          sent_at: '2026-09-30T18:05:00.000Z',
          revision: 1,
          snapshot_version: 1
        },
        {
          id: arabicReportId,
          school_id: schoolId,
          student_id: 'e0000000-0000-0000-0000-000000000002',
          period_start: '2026-09-01',
          period_end: '2026-09-30',
          language: 'ar',
          status: 'READY',
          snapshot_json: reportSnapshot(
            'e0000000-0000-0000-0000-000000000002',
            'Omar Hassan',
            'عمر حسن',
            'ar'
          ),
          generated_at: '2026-09-30T18:01:00.000Z',
          revision: 1,
          snapshot_version: 1
        },
        {
          id: failedReportId,
          school_id: schoolId,
          student_id: 'e0000000-0000-0000-0000-000000000003',
          period_start: '2026-09-01',
          period_end: '2026-09-30',
          language: 'both',
          status: 'FAILED',
          snapshot_json: reportSnapshot(
            'e0000000-0000-0000-0000-000000000003',
            'Lina Khalil',
            'لينا خليل',
            'both'
          ),
          generated_at: '2026-09-30T18:02:00.000Z',
          revision: 1,
          snapshot_version: 1
        }
      ]);

    if (reportError) throw reportError;

    const {error: deliveryError} = await supabase
      .from('email_deliveries')
      .insert([
        {
          id: '71000000-0000-0000-0000-000000000001',
          school_id: schoolId,
          report_id: englishReportId,
          student_id: 'e0000000-0000-0000-0000-000000000001',
          period_start: '2026-09-01',
          period_end: '2026-09-30',
          guardian_id: 'f0000000-0000-0000-0000-000000000001',
          recipient_email: 'guardian01@example.test',
          provider: 'e2e',
          provider_message_id: 'e2e-sent-1',
          status: 'SENT',
          sent_at: '2026-09-30T18:05:00.000Z'
        },
        {
          id: '71000000-0000-0000-0000-000000000002',
          school_id: schoolId,
          report_id: arabicReportId,
          student_id: 'e0000000-0000-0000-0000-000000000002',
          period_start: '2026-09-01',
          period_end: '2026-09-30',
          guardian_id: 'f0000000-0000-0000-0000-000000000002',
          recipient_email: 'guardian02@example.test',
          provider: 'e2e',
          status: 'PENDING'
        },
        {
          id: '71000000-0000-0000-0000-000000000003',
          school_id: schoolId,
          report_id: failedReportId,
          student_id: 'e0000000-0000-0000-0000-000000000003',
          period_start: '2026-09-01',
          period_end: '2026-09-30',
          guardian_id: 'f0000000-0000-0000-0000-000000000003',
          recipient_email: 'guardian03@example.test',
          provider: 'e2e',
          status: 'FAILED',
          error_message: 'Test delivery failure'
        }
      ]);

    if (deliveryError) throw deliveryError;
  });

  test.afterAll(async () => {
    await cleanupReportFixtures();
  });
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

      const englishHistory = page.locator('details.report-cycle-history');
      await expect(englishHistory.locator('summary')).toHaveText('Historical Subject and Group reports');
      await expect(englishHistory.getByRole('button', {name: 'Apply'})).toBeHidden();
      await englishHistory.locator('summary').click();
      await expect(englishHistory.getByRole('button', {name: 'Apply'})).toBeVisible();
      await expect(englishHistory.getByRole('button', {name: 'Open report'}).first()).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: 'View delivery status'
        })
      ).toHaveAttribute(
        'href',
        '/en/reports/delivery-status'
      );

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

      const englishMobileHistory = page.locator('details.report-cycle-history');
      await englishMobileHistory.locator('summary').click();
      await expect(englishMobileHistory.getByRole('button', {name: 'Apply'})).toBeVisible();

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

      const arabicHistory = page.locator('details.report-cycle-history');
      await expect(arabicHistory.locator('summary')).toHaveText('تقارير المواد والمجموعات السابقة');
      await arabicHistory.locator('summary').click();
      await expect(arabicHistory.getByRole('button', {name: 'تطبيق'})).toBeVisible();
      await expect(arabicHistory.getByRole('button', {name: 'فتح التقرير'}).first()).toBeVisible();

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

      const arabicMobileHistory = page.locator('details.report-cycle-history');
      await arabicMobileHistory.locator('summary').click();
      await expect(arabicMobileHistory.getByRole('button', {name: 'تطبيق'})).toBeVisible();

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
