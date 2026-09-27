'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {isLocale, type Locale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {databaseUuid} from '@/lib/validation/fields';

import {
  finalizeReportBatch,
  getReportBatchWorkspace,
  reviewReportBatch
} from './report-batch.repository';
import {
  ensureAdminReportContextBatch,
  reopenAdminReportWorkspace,
  saveAdminReportWorkspace
} from './admin-report-workspace.repository';
import {reportPeriodSchema} from './report.schemas';
import type {ReportPerformance} from './report.types';

const performanceSchema = z.enum([
  'EXCELLENT',
  'GOOD',
  'DEVELOPING',
  'NEEDS_SUPPORT'
]);

function localeFrom(formData: FormData): Locale {
  const raw = String(formData.get('locale') ?? 'en');
  return isLocale(raw) ? raw : 'en';
}

function reportRedirect(
  locale: Locale,
  periodStart: string,
  periodEnd: string,
  batchId?: string,
  suffix?: string
) {
  const params = new URLSearchParams({
    periodStart,
    periodEnd
  });

  if (batchId) params.set('batchId', batchId);

  if (suffix) {
    const [key, value = '1'] = suffix.split('=');
    params.set(key, value);
  }

  return `/${locale}/reports?${params.toString()}`;
}

function periodFrom(formData: FormData) {
  return reportPeriodSchema.safeParse({
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd')
  });
}

function batchIdFrom(formData: FormData) {
  return databaseUuid.safeParse(formData.get('batchId'));
}

function optionalGroupIdFrom(formData: FormData) {
  const raw = String(
    formData.get('subjectGroupId') ?? ''
  ).trim();

  if (!raw) return {success: true as const, data: null};

  const parsed = databaseUuid.safeParse(raw);

  return parsed.success
    ? {success: true as const, data: parsed.data}
    : {success: false as const};
}

function cleanText(value: FormDataEntryValue | null) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

function workspacePayloadFrom(formData: FormData) {
  const batchId = batchIdFrom(formData);
  const period = periodFrom(formData);

  if (!batchId.success || !period.success) return null;

  const rawPerformance = String(
    formData.get('performance') ?? ''
  ).trim();

  let performance: ReportPerformance | null = null;

  if (rawPerformance) {
    const parsed = performanceSchema.safeParse(rawPerformance);
    if (!parsed.success) return null;
    performance = parsed.data;
  }

  const studentIds = [
    ...new Set(
      formData
        .getAll('studentId')
        .map(String)
        .filter(Boolean)
    )
  ];

  const validStudentIds: string[] = [];

  for (const studentId of studentIds) {
    const parsed = databaseUuid.safeParse(studentId);
    if (!parsed.success) return null;
    validStudentIds.push(parsed.data);
  }

  return {
    batchId: batchId.data,
    periodStart: period.data.periodStart,
    periodEnd: period.data.periodEnd,
    mainReportEn: cleanText(formData.get('mainReportEn')),
    mainReportAr: cleanText(formData.get('mainReportAr')),
    performance,
    studentComments: validStudentIds.map((studentId) => ({
      studentId,
      commentEn: cleanText(
        formData.get(`commentEn:${studentId}`)
      ),
      commentAr: cleanText(
        formData.get(`commentAr:${studentId}`)
      )
    }))
  };
}

export async function openAdminReportContextAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const period = periodFrom(formData);

  const classId = databaseUuid.safeParse(
    formData.get('classId')
  );

  const classSubjectId = databaseUuid.safeParse(
    formData.get('classSubjectId')
  );

  const subjectGroupId = optionalGroupIdFrom(formData);

  if (
    !period.success ||
    !classId.success ||
    !classSubjectId.success ||
    !subjectGroupId.success
  ) {
    redirect(`/${locale}/reports?error=validation`);
  }

  let batchId: string;

  try {
    batchId = await ensureAdminReportContextBatch({
      schoolId: profile.schoolId,
      createdByProfileId: profile.id,
      classId: classId.data,
      classSubjectId: classSubjectId.data,
      subjectGroupId: subjectGroupId.data,
      periodStart: period.data.periodStart,
      periodEnd: period.data.periodEnd
    });
  } catch (error) {
    console.error('Unable to open report context', {error});

    redirect(
      reportRedirect(
        locale,
        period.data.periodStart,
        period.data.periodEnd,
        undefined,
        'error=save'
      )
    );
  }

  redirect(
    reportRedirect(
      locale,
      period.data.periodStart,
      period.data.periodEnd,
      batchId
    )
  );
}

export async function saveAdminReportWorkspaceAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const payload = workspacePayloadFrom(formData);

  if (!payload) {
    redirect(`/${locale}/reports?error=validation`);
  }

  try {
    await saveAdminReportWorkspace({
      schoolId: profile.schoolId,
      batchId: payload.batchId,
      mainReportEn: payload.mainReportEn,
      mainReportAr: payload.mainReportAr,
      performance: payload.performance,
      studentComments: payload.studentComments
    });
  } catch (error) {
    console.error('Unable to save report workspace', {error});

    redirect(
      reportRedirect(
        locale,
        payload.periodStart,
        payload.periodEnd,
        payload.batchId,
        'error=save'
      )
    );
  }

  revalidatePath(`/${locale}/reports`);

  redirect(
    reportRedirect(
      locale,
      payload.periodStart,
      payload.periodEnd,
      payload.batchId,
      'saved=1'
    )
  );
}

export async function finalizeAdminReportWorkspaceAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const payload = workspacePayloadFrom(formData);

  if (!payload) {
    redirect(`/${locale}/reports?error=validation`);
  }

  try {
    await saveAdminReportWorkspace({
      schoolId: profile.schoolId,
      batchId: payload.batchId,
      mainReportEn: payload.mainReportEn,
      mainReportAr: payload.mainReportAr,
      performance: payload.performance,
      studentComments: payload.studentComments
    });

    const workspace = await getReportBatchWorkspace(
      profile.schoolId,
      payload.batchId
    );

    if (!workspace) {
      throw new Error('Report workspace not found');
    }

    if (workspace.batch.status === 'DRAFT') {
      await reviewReportBatch(
        profile.schoolId,
        payload.batchId
      );
    }

    await finalizeReportBatch(
      profile.schoolId,
      payload.batchId
    );
  } catch (error) {
    console.error('Unable to finalize report workspace', {
      error
    });

    redirect(
      reportRedirect(
        locale,
        payload.periodStart,
        payload.periodEnd,
        payload.batchId,
        'error=save'
      )
    );
  }

  revalidatePath(`/${locale}/reports`);

  redirect(
    reportRedirect(
      locale,
      payload.periodStart,
      payload.periodEnd,
      payload.batchId,
      'finalized=1'
    )
  );
}

export async function reopenAdminReportWorkspaceAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const batchId = batchIdFrom(formData);
  const period = periodFrom(formData);

  if (!batchId.success || !period.success) {
    redirect(`/${locale}/reports?error=validation`);
  }

  try {
    await reopenAdminReportWorkspace(
      profile.schoolId,
      batchId.data
    );
  } catch (error) {
    console.error('Unable to reopen report workspace', {
      error
    });

    redirect(
      reportRedirect(
        locale,
        period.data.periodStart,
        period.data.periodEnd,
        batchId.data,
        'error=save'
      )
    );
  }

  revalidatePath(`/${locale}/reports`);

  redirect(
    reportRedirect(
      locale,
      period.data.periodStart,
      period.data.periodEnd,
      batchId.data
    )
  );
}
