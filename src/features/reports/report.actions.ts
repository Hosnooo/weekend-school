'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {isLocale, type Locale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {databaseUuid} from '@/lib/validation/fields';

import {
  approveAllSubmittedSources,
  createReportBatch,
  finalizeReportBatch,
  reviewReportBatch,
  type ReportBatchScope
} from './report-batch.repository';
import {buildReportReadiness, generateReportSnapshots} from './report.repository';
import {reportPeriodSchema} from './report.schemas';

function localeFrom(formData: FormData): Locale {
  const raw = String(formData.get('locale') ?? 'en');
  return isLocale(raw) ? raw : 'en';
}

function idFrom(formData: FormData, name: string) {
  const parsed = databaseUuid.safeParse(formData.get(name));
  if (!parsed.success) throw new Error(`Invalid ${name}`);
  return parsed.data;
}

function batchRedirect(locale: Locale, batchId: string, periodStart: string, periodEnd: string) {
  return `/${locale}/reports?batchId=${encodeURIComponent(batchId)}&periodStart=${periodStart}&periodEnd=${periodEnd}`;
}

export async function prepareReportBatchAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const period = reportPeriodSchema.safeParse({
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd')
  });
  if (!period.success) redirect(`/${locale}/reports?error=validation`);

  const rawScope = String(formData.get('scopeType') ?? 'CLASS');
  const scopeType: ReportBatchScope = rawScope === 'SUBJECT' || rawScope === 'GROUP' ? rawScope : 'CLASS';
  const classId = idFrom(formData, 'classId');
  const classSubjectId = scopeType === 'CLASS' ? null : idFrom(formData, 'classSubjectId');
  const subjectGroupId = scopeType === 'GROUP' ? idFrom(formData, 'subjectGroupId') : null;
  let batchId: string;

  try {
    batchId = await createReportBatch({
      schoolId: profile.schoolId,
      createdByProfileId: profile.id,
      scopeType,
      classId,
      classSubjectId,
      subjectGroupId,
      periodStart: period.data.periodStart,
      periodEnd: period.data.periodEnd
    });
  } catch (error) {
    console.error('Unable to prepare report batch', {error});
    redirect(`/${locale}/reports?periodStart=${period.data.periodStart}&periodEnd=${period.data.periodEnd}&error=save`);
  }
  redirect(batchRedirect(locale, batchId, period.data.periodStart, period.data.periodEnd));
}

export async function approveAllReportSourcesAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const batchId = idFrom(formData, 'batchId');
  const periodStart = String(formData.get('periodStart') ?? '');
  const periodEnd = String(formData.get('periodEnd') ?? '');
  try {
    await approveAllSubmittedSources(profile.schoolId, batchId);
  } catch (error) {
    console.error('Unable to approve report sources', {error});
    redirect(`${batchRedirect(locale, batchId, periodStart, periodEnd)}&error=save`);
  }
  revalidatePath(`/${locale}/reports`);
  redirect(batchRedirect(locale, batchId, periodStart, periodEnd));
}

export async function reviewReportBatchAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const batchId = idFrom(formData, 'batchId');
  const periodStart = String(formData.get('periodStart') ?? '');
  const periodEnd = String(formData.get('periodEnd') ?? '');
  try {
    await reviewReportBatch(profile.schoolId, batchId);
  } catch (error) {
    console.error('Unable to move report batch to review', {error});
    redirect(`${batchRedirect(locale, batchId, periodStart, periodEnd)}&error=save`);
  }
  revalidatePath(`/${locale}/reports`);
  redirect(batchRedirect(locale, batchId, periodStart, periodEnd));
}

export async function finalizeReportBatchAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const batchId = idFrom(formData, 'batchId');
  const periodStart = String(formData.get('periodStart') ?? '');
  const periodEnd = String(formData.get('periodEnd') ?? '');
  try {
    await finalizeReportBatch(profile.schoolId, batchId);
  } catch (error) {
    console.error('Unable to finalize report batch', {error});
    redirect(`${batchRedirect(locale, batchId, periodStart, periodEnd)}&error=save`);
  }
  revalidatePath(`/${locale}/reports`);
  redirect(batchRedirect(locale, batchId, periodStart, periodEnd));
}

// Legacy v1 generation remains available for existing finalized-report history and compatibility.
export async function generateReportsAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = reportPeriodSchema.safeParse({
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd')
  });
  if (!parsed.success) redirect(`/${locale}/reports?error=validation`);
  let inserted = 0;
  try {
    const readiness = await buildReportReadiness(profile.schoolId, parsed.data.periodStart, parsed.data.periodEnd);
    inserted = await generateReportSnapshots(readiness.snapshots);
  } catch (error) {
    console.error('Unable to generate reports', {error});
    redirect(`/${locale}/reports?periodStart=${parsed.data.periodStart}&periodEnd=${parsed.data.periodEnd}&error=save`);
  }
  revalidatePath(`/${locale}/reports`);
  redirect(`/${locale}/reports?periodStart=${parsed.data.periodStart}&periodEnd=${parsed.data.periodEnd}&generated=${inserted}`);
}
