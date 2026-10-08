import {randomUUID} from 'node:crypto';

import {createClient} from '@supabase/supabase-js';
import {expect, test} from '@playwright/test';

import {redesign} from './redesign-fixtures';
import {credentials, login} from './helpers';

// Fresh local E2E databases are reset for each workflow run, so fixed
// enrollment-overlapping test dates avoid random, hard-to-reproduce failures.
const cycleStart = '2035-01-01';
const cycleEnd = '2035-01-07';

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

    // Exclusion must be reflected before finalization. The button may stay
    // enabled if other reviewed contexts remain; don't infer its state from
    // only this one Teaching Update.
    await expect(sourceCard).toContainText('Excluded');

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
      name: 'Finalize and prepare to send'
    }).click();

    await expect(
      page.getByText('Student reports are ready to send.', {exact: true})
    ).toBeVisible();

    // Finalization prepares immutable reports but must not start email delivery.
    await expect(page.getByRole('button', {name: 'Send reports'})).toBeVisible();
    await expect(page.getByRole('button', {
      name: 'Reopen for admin editing'
    })).toBeVisible();
    await expect(page.getByRole('link', {
      name: 'View delivery status'
    })).toBeVisible();

    // The modern editor renders an inline parent-email preview for the
    // selected student. There is no separate "Preview report" link.
    const emailReview = page.locator('.report-email-review-panel');
    await expect(emailReview).toBeVisible();
    await emailReview.locator('select').selectOption(
      'e0000000-0000-0000-0000-000000000001'
    );
    await expect(emailReview.locator('iframe.report-preview')).toBeVisible();

    const frame = emailReview.frameLocator('iframe.report-preview');
    await expect(frame.getByText('MCE Weekend School')).toBeVisible();
    await expect(frame.getByText('Report cycle source lesson')).toBeVisible();

    // A prepared but unsent cycle must be editable without asking the Teacher
    // to resubmit. Reopen returns prepared reports to review state.
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', {name: 'Reopen for admin editing'}).click();
    await expect(page.getByRole('button', {
      name: 'Finalize and prepare to send'
    })).toBeVisible();
    await expect(page.locator('.report-source-row')
      .filter({hasText: 'Faith & Character'})
      .first()).toContainText('Included');

    await page.getByRole('button', {name: 'Finalize and prepare to send'}).click();
    await expect(page.getByText(
      'Student reports are ready to send.', {exact: true}
    )).toBeVisible();

    // Dismissing only an unsent cycle should remove its prepared reports and
    // review data. The submitted Teacher update must remain in the database.
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', {name: 'Dismiss cycle'}).click();
    await expect(page).toHaveURL(/\/en\/reports\?dismissed=1/);
    await expect(page.getByText('Unsent Report Cycle dismissed.')).toBeVisible();

    expect(runtimeErrors).toEqual([]);
  }
);
