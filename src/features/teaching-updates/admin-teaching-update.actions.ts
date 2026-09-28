'use server';

import type {SupabaseClient} from '@supabase/supabase-js';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {isLocale, type Locale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {databaseUuid} from '@/lib/validation/fields';

function localeFrom(formData: FormData): Locale {
  const raw = String(formData.get('locale') ?? 'en');
  return isLocale(raw) ? raw : 'en';
}

function cleanText(value: FormDataEntryValue | null) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function exactDatesFrom(formData: FormData) {
  const raw = String(formData.get('dates') ?? '');

  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ].sort();
}

function route(
  locale: Locale,
  suffix?: string
) {
  return `/${locale}/teaching-updates${
    suffix ? `?${suffix}` : ''
  }`;
}

async function database() {
  const typed = await createServerSupabaseClient();
  return typed as unknown as SupabaseClient;
}

export async function requestAdminTeachingUpdateAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');

  const classSubjectId = databaseUuid.safeParse(
    formData.get('classSubjectId')
  );

  const coverageKind = String(
    formData.get('coverageKind') ?? ''
  );

  const periodStart = String(
    formData.get('periodStart') ?? ''
  ).trim();

  const periodEnd = String(
    formData.get('periodEnd') ?? ''
  ).trim();

  const dates = exactDatesFrom(formData);

  const rangeValid =
    coverageKind === 'RANGE' &&
    validDate(periodStart) &&
    validDate(periodEnd) &&
    periodStart <= periodEnd;

  const datesValid =
    coverageKind === 'DATES' &&
    dates.length > 0 &&
    dates.every(validDate);

  if (
    !classSubjectId.success ||
    (!rangeValid && !datesValid)
  ) {
    redirect(route(locale, 'error=validation'));
  }

  const db = await database();

  const {error} = await db.rpc(
    'request_teaching_update',
    {
      p_class_subject_id: classSubjectId.data,
      p_coverage_kind: coverageKind,
      p_period_start:
        coverageKind === 'RANGE' ? periodStart : null,
      p_period_end:
        coverageKind === 'RANGE' ? periodEnd : null,
      p_dates:
        coverageKind === 'DATES' ? dates : [],
      p_admin_note: cleanText(formData.get('adminNote'))
    }
  );

  if (error) {
    console.error(
      'Unable to request Teaching Update',
      {error}
    );
    redirect(route(locale, 'error=request'));
  }

  revalidatePath(`/${locale}/teaching-updates`);
  revalidatePath(`/${locale}/my-teaching`);

  redirect(route(locale, 'requested=1'));
}

export async function reopenAdminTeachingUpdateAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');

  const submissionId = databaseUuid.safeParse(
    formData.get('submissionId')
  );

  if (!submissionId.success) {
    redirect(route(locale, 'error=validation'));
  }

  const db = await database();

  const {data, error} = await db.rpc(
    'reopen_weekly_submission',
    {
      p_submission_id: submissionId.data
    }
  );

  if (error || data !== true) {
    console.error(
      'Unable to reopen Teaching Update',
      {error}
    );
    redirect(route(locale, 'error=reopen'));
  }

  revalidatePath(`/${locale}/teaching-updates`);
  revalidatePath(`/${locale}/my-teaching`);

  redirect(route(locale, 'reopened=1'));
}

export async function dismissAdminTeachingUpdateAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');

  const submissionId = databaseUuid.safeParse(
    formData.get('submissionId')
  );

  const version = Number(
    formData.get('version')
  );

  if (
    !submissionId.success ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    redirect(route(locale, 'error=validation'));
  }

  const db = await database();

  const {data, error} = await db.rpc(
    'dismiss_teaching_update',
    {
      p_submission_id: submissionId.data,
      p_reason: cleanText(formData.get('reason')),
      p_expected_version: version
    }
  );

  if (error || data !== true) {
    console.error(
      'Unable to dismiss Teaching Update',
      {error}
    );
    redirect(route(locale, 'error=dismiss'));
  }

  revalidatePath(`/${locale}/teaching-updates`);
  revalidatePath(`/${locale}/my-teaching`);

  redirect(route(locale, 'dismissed=1'));
}
