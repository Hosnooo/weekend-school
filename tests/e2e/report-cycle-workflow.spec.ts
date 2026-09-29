import {randomUUID} from 'node:crypto';

import {createClient} from '@supabase/supabase-js';
import {expect, test} from '@playwright/test';

import {redesign} from './redesign-fixtures';
import {credentials, login} from './helpers';

const dayMs = 24 * 60 * 60 * 1000;
const startBase = Date.UTC(2035, 0, 1);
const randomDayOffset = Math.floor(Math.random() * 20_000);

const startDate = new Date(
  startBase + randomDayOffset * dayMs
);
const endDate = new Date(startDate.getTime() + 6 * dayMs);

const dateOnly = (value: Date) =>
  value.toISOString().slice(0, 10);

const cycleStart = dateOnly(startDate);
const cycleEnd = dateOnly(endDate);

const sourceId = randomUUID();

test.beforeAll(async () => {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Local Supabase service-role configuration is required'
    );
  }

  const db = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const {error: sourceError} = await db
    .from('weekly_submissions')
    .insert({
      id: sourceId,
      school_id:
        'a0000000-0000-0000-0000-000000000001',
      class_subject_id:
        redesign.wholeClassSubjectId,
      subject_group_id: null,
      teacher_id:
        'c0000000-0000-0000-0000-000000000002',
      week_start: cycleStart,
      coverage_kind: 'RANGE',
      period_start: cycleStart,
      period_end: cycleEnd,
      status: 'DRAFT',
      progress_en: 'Report cycle source lesson',
      default_performance: 'GOOD'
    });

  if (sourceError) throw sourceError;

  const {error: studentError} = await db
    .from('weekly_submission_students')
    .insert({
      school_id:
        'a0000000-0000-0000-0000-000000000001',
      submission_id: sourceId,
      student_id:
        'e0000000-0000-0000-0000-000000000001',
      attendance_status: 'PRESENT'
    });

  if (studentError) throw studentError;

  const {error: submitError} = await db
    .from('weekly_submissions')
    .update({
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString()
    })
    .eq('id', sourceId);

  if (submitError) throw submitError;
});

test(
  'Admin creates a Report Cycle and controls Teaching Update sources',
  async ({page}) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    await login(
      page,
      'en',
      credentials.admin
    );

    await page.goto('/en/reports');

    const createDisclosure = page.locator('details.report-cycle-create');
    await expect(createDisclosure).toBeVisible({timeout: 5_000});
    await expect(createDisclosure.locator('form')).toBeHidden();
    await createDisclosure.locator('summary').click();

    const createCycleForm = page.locator('form').filter({
      has: page.getByRole('button', {
        name: 'Create Report Cycle'
      })
    });

    await createCycleForm
      .locator('select[name="classId"]')
      .selectOption(redesign.classId);

    await createCycleForm
      .locator('input[name="periodStart"]')
      .fill(cycleStart);

    await createCycleForm
      .locator('input[name="periodEnd"]')
      .fill(cycleEnd);

    await createCycleForm
      .getByRole('button', {
        name: 'Create Report Cycle'
      })
      .click();

    await expect(
      page.getByRole('heading', {
        name: 'Report Cycle · Foundations'
      })
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {
        name: 'Sources'
      })
    ).toBeVisible();

    const sourceCard = page
      .locator('.report-source-row')
      .filter({
        hasText: 'Faith & Character'
      })
      .first();

    await expect(sourceCard).toContainText('Included');
    await expect(sourceCard).toContainText(new Intl.DateTimeFormat('en', {dateStyle: 'medium', timeZone: 'UTC'}).format(new Date(`${cycleStart}T12:00:00Z`)));
    await expect(sourceCard).toContainText(new Intl.DateTimeFormat('en', {dateStyle: 'medium', timeZone: 'UTC'}).format(new Date(`${cycleEnd}T12:00:00Z`)));

    await sourceCard
      .getByRole('button', {name: 'Exclude'})
      .click();

    await expect(sourceCard).toContainText('Excluded');

    await expect(
      page.getByRole('button', {
        name: 'Generate student reports'
      })
    ).toBeDisabled();

    await sourceCard
      .getByRole('button', {name: 'Include'})
      .click();

    await expect(sourceCard).toContainText('Included');

    await expect(
      page.getByRole('button', {
        name: 'Request update'
      }).first()
    ).toBeVisible();

    await page.getByRole('button', {
      name: 'Generate student reports'
    }).click();

    await expect(
      page.getByText('Ready to send', {
        exact: true
      }).first()
    ).toBeVisible();

    const preview = page.getByRole('link', {
      name: 'Preview report'
    }).first();

    await expect(preview).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: 'Send reports'
      })
    ).toBeVisible();

    await expect(
      page.getByRole('link', {
        name: 'View delivery status'
      })
    ).toBeVisible();

    await preview.click();

    const frame = page.frameLocator(
      'iframe[title="Report preview"]'
    );

    await expect(
      frame.getByText('MCE Weekend School')
    ).toBeVisible();

    await expect(
      frame.getByText('Report cycle source lesson')
    ).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  }
);
