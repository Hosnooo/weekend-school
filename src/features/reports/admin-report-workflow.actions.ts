'use server';

import type {SupabaseClient} from '@supabase/supabase-js';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {isLocale, type Locale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {databaseUuid} from '@/lib/validation/fields';

import {
  createClassReportCycle,
  deleteClassReportCycle,
  finalizeReportBatch,
  getReportBatchWorkspace,
  reviewReportBatch
} from './report-batch.repository';
import {
  ensureAdminReportContextBatch,
  reopenAdminReportWorkspace,
  saveAdminReportWorkspace
} from './admin-report-workspace.repository';
import {
  ensureClassReportCycleReview,
  rebuildClassReportReviewContext,
  saveClassReportReviewContext,
  setClassReportCycleSourceIncluded
} from './class-report-review.repository';
import {
  finalizeClassReportCycleReports
} from './class-report-finalization.repository';
import {reportPeriodSchema} from './report.schemas';
import {getActiveReportTemplate} from './report-template.repository';
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

  const routeBatchId = params.get('batchId');

  if (routeBatchId) {
    params.delete('batchId');
  }

  const basePath = routeBatchId
    ? `/${locale}/reports/workspace/${routeBatchId}`
    : `/${locale}/reports`;

  return `${basePath}?${params.toString()}`;
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

  const includePerformance =
    formData.get('includePerformance') === '1';
  const includeStudentComments =
    formData.get('includeStudentComments') === '1';

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

  const studentComments: Array<{
    studentId: string;
    performance: ReportPerformance | null;
    commentEn: string | null;
    commentAr: string | null;
  }> = [];

  for (const studentId of validStudentIds) {
    let performance: ReportPerformance | null = null;

    if (includePerformance) {
      const rawPerformance = String(
        formData.get(`performance:${studentId}`) ?? ''
      ).trim();

      if (rawPerformance) {
        const parsed = performanceSchema.safeParse(rawPerformance);
        if (!parsed.success) return null;
        performance = parsed.data;
      }
    }

    studentComments.push({
      studentId,
      performance,
      commentEn: cleanText(
        formData.get(`commentEn:${studentId}`)
      ),
      commentAr: cleanText(
        formData.get(`commentAr:${studentId}`)
      )
    });
  }

  return {
    batchId: batchId.data,
    periodStart: period.data.periodStart,
    periodEnd: period.data.periodEnd,
    mainReportEn: cleanText(formData.get('mainReportEn')),
    mainReportAr: cleanText(formData.get('mainReportAr')),
    includePerformance,
    includeStudentComments,
    studentComments
  };
}

function classReviewPayloadFrom(formData: FormData) {
  const batchId = batchIdFrom(formData);
  const period = periodFrom(formData);
  const classSubjectId = databaseUuid.safeParse(
    formData.get('classSubjectId')
  );
  const subjectGroupId = optionalGroupIdFrom(formData);

  if (
    !batchId.success ||
    !period.success ||
    !classSubjectId.success ||
    !subjectGroupId.success
  ) {
    return null;
  }

  const includePerformance =
    formData.get('includePerformance') === '1';
  const includeStudentComments =
    formData.get('includeStudentComments') === '1';
  const studentIds = [
    ...new Set(
      formData
        .getAll('studentId')
        .map(String)
        .filter(Boolean)
    )
  ];

  const students: Array<{
    studentId: string;
    progressEn: string | null;
    progressAr: string | null;
    performance: ReportPerformance | null;
    performanceOverridden: boolean;
    commentEn: string | null;
    commentAr: string | null;
  }> = [];

  for (const studentId of studentIds) {
    const parsedStudentId = databaseUuid.safeParse(studentId);
    if (!parsedStudentId.success) return null;

    const rawPerformance = String(
      formData.get(`performance:${studentId}`) ?? ''
    ).trim();
    let performance: ReportPerformance | null = null;

    if (includePerformance && rawPerformance) {
      const parsedPerformance = performanceSchema.safeParse(rawPerformance);
      if (!parsedPerformance.success) return null;
      performance = parsedPerformance.data;
    }

    students.push({
      studentId: parsedStudentId.data,
      progressEn: cleanText(
        formData.get(`progressEn:${studentId}`)
      ),
      progressAr: cleanText(
        formData.get(`progressAr:${studentId}`)
      ),
      performance,
      performanceOverridden:
        includePerformance && Boolean(rawPerformance),
      commentEn: cleanText(
        formData.get(`commentEn:${studentId}`)
      ),
      commentAr: cleanText(
        formData.get(`commentAr:${studentId}`)
      )
    });
  }

  return {
    batchId: batchId.data,
    periodStart: period.data.periodStart,
    periodEnd: period.data.periodEnd,
    classSubjectId: classSubjectId.data,
    subjectGroupId: subjectGroupId.data,
    mainReportEn: cleanText(formData.get('mainReportEn')),
    mainReportAr: cleanText(formData.get('mainReportAr')),
    includePerformance,
    includeStudentComments,
    students
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
      includePerformance: payload.includePerformance,
      includeStudentComments: payload.includeStudentComments,
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
      includePerformance: payload.includePerformance,
      includeStudentComments: payload.includeStudentComments,
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
  revalidatePath(`/${locale}/reports/workspace/${batchId.data}`);

  redirect(
    reportRedirect(
      locale,
      period.data.periodStart,
      period.data.periodEnd,
      batchId.data
    )
  );
}

export async function cancelClassReportCycleAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const batchId = batchIdFrom(formData);

  if (!batchId.success) {
    redirect(`/${locale}/reports?error=validation`);
  }

  try {
    await deleteClassReportCycle(profile.schoolId, batchId.data);
  } catch (error) {
    console.error('Unable to cancel Report Cycle', {error});
    redirect(`/${locale}/reports?error=save`);
  }

  revalidatePath(`/${locale}/reports`);
  redirect(`/${locale}/reports?cancelled=1`);
}

export async function createClassReportCycleAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');

  const classId = databaseUuid.safeParse(
    formData.get('classId')
  );

  const period = periodFrom(formData);

  if (!classId.success || !period.success) {
    redirect(`/${locale}/reports?error=validation`);
  }

  let batchId: string;

  try {
    const template =
      await getActiveReportTemplate(profile.schoolId);

    batchId = await createClassReportCycle(
      classId.data,
      period.data.periodStart,
      period.data.periodEnd,
      template.id
    );
  } catch (error) {
    console.error('Unable to create Report Cycle', {error});

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

  revalidatePath(`/${locale}/reports`);

  redirect(
    reportRedirect(
      locale,
      period.data.periodStart,
      period.data.periodEnd,
      batchId
    )
  );
}

export async function saveClassReportReviewContextAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const payload = classReviewPayloadFrom(formData);

  if (!payload) {
    redirect(`/${locale}/reports?error=validation`);
  }

  try {
    await saveClassReportReviewContext({
      schoolId: profile.schoolId,
      batchId: payload.batchId,
      classSubjectId: payload.classSubjectId,
      subjectGroupId: payload.subjectGroupId,
      mainReportEn: payload.mainReportEn,
      mainReportAr: payload.mainReportAr,
      includePerformance: payload.includePerformance,
      includeStudentComments: payload.includeStudentComments,
      students: payload.students
    });
  } catch (error) {
    console.error('Unable to save Class Report Cycle review', {error});
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
  revalidatePath(`/${locale}/reports/workspace/${payload.batchId}`);

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

export async function rebuildClassReportReviewContextAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const batchId = batchIdFrom(formData);
  const period = periodFrom(formData);
  const classSubjectId = databaseUuid.safeParse(
    formData.get('classSubjectId')
  );
  const subjectGroupId = optionalGroupIdFrom(formData);

  if (
    !batchId.success ||
    !period.success ||
    !classSubjectId.success ||
    !subjectGroupId.success
  ) {
    redirect(`/${locale}/reports?error=validation`);
  }

  try {
    await rebuildClassReportReviewContext({
      schoolId: profile.schoolId,
      batchId: batchId.data,
      classSubjectId: classSubjectId.data,
      subjectGroupId: subjectGroupId.data
    });
  } catch (error) {
    console.error('Unable to rebuild Class Report Cycle review', {error});
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

  revalidatePath(`/${locale}/reports/workspace/${batchId.data}`);
  redirect(
    reportRedirect(
      locale,
      period.data.periodStart,
      period.data.periodEnd,
      batchId.data,
      'saved=1'
    )
  );
}

export async function setReportCycleSourceIncludedAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');

  const batchId = batchIdFrom(formData);
  const submissionId = databaseUuid.safeParse(
    formData.get('submissionId')
  );

  const included =
    String(formData.get('included') ?? '') === 'true';

  if (!batchId.success || !submissionId.success) {
    redirect(`/${locale}/reports?error=validation`);
  }

  try {
    await setClassReportCycleSourceIncluded({
      batchId: batchId.data,
      submissionId: submissionId.data,
      included
    });
  } catch (error) {
    console.error(
      'Unable to change Report Cycle source selection',
      {error}
    );

    redirect(
      `/${locale}/reports/workspace/${batchId.data}?error=save`
    );
  }

  revalidatePath(
    `/${locale}/reports/workspace/${batchId.data}`
  );

  redirect(
    `/${locale}/reports/workspace/${batchId.data}`
  );
}

export async function requestReportCycleMissingUpdateAction(
  formData: FormData
) {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');

  const batchId = batchIdFrom(formData);
  const classSubjectId = databaseUuid.safeParse(
    formData.get('classSubjectId')
  );

  const period = periodFrom(formData);

  if (
    !batchId.success ||
    !classSubjectId.success ||
    !period.success
  ) {
    redirect(`/${locale}/reports?error=validation`);
  }

  const db =
    (await createServerSupabaseClient()) as unknown as SupabaseClient;

  const {error} = await db.rpc(
    'request_teaching_update',
    {
      p_class_subject_id: classSubjectId.data,
      p_coverage_kind: 'RANGE',
      p_period_start: period.data.periodStart,
      p_period_end: period.data.periodEnd,
      p_dates: [],
      p_admin_note: null
    }
  );

  if (error) {
    console.error(
      'Unable to request missing Report Cycle update',
      {error}
    );

    redirect(
      `/${locale}/reports/workspace/${batchId.data}?error=save`
    );
  }

  revalidatePath(
    `/${locale}/reports/workspace/${batchId.data}`
  );
  revalidatePath(`/${locale}/teaching-updates`);
  revalidatePath(`/${locale}/my-teaching`);

  redirect(
    `/${locale}/reports/workspace/${batchId.data}?requested=1`
  );
}

export async function finalizeClassReportCycleAction(
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
    await ensureClassReportCycleReview(
      profile.schoolId,
      batchId.data
    );

    const workspace = await getReportBatchWorkspace(
      profile.schoolId,
      batchId.data
    );

    if (!workspace) {
      throw new Error('Report Cycle not found');
    }

    if (workspace.batch.status === 'DRAFT') {
      await reviewReportBatch(
        profile.schoolId,
        batchId.data
      );
    }

    await finalizeClassReportCycleReports(
      profile.schoolId,
      batchId.data
    );
  } catch (error) {
    console.error(
      'Unable to generate Class Report Cycle reports',
      {error}
    );

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
  revalidatePath(
    `/${locale}/reports/workspace/${batchId.data}`
  );

  redirect(
    reportRedirect(
      locale,
      period.data.periodStart,
      period.data.periodEnd,
      batchId.data,
      'finalized=1'
    )
  );
}
