'use server';

import {
  renderReportEmail,
  renderReportEmailSubject
} from '@/features/email/report-email';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import {databaseUuid} from '@/lib/validation/fields';

import {getClassReportCycleLivePreview} from './class-report-finalization.repository';
import {getClassReportPreviewRecipients} from './class-report-preview.repository';
import {getClassReportCycleWorkspace} from './report-batch.repository';
import {getReport} from './report.repository';
import type {ReportSnapshotV2} from './report.types';

export async function getClassReportCycleEmailPreviewAction(input: {
  batchId: string;
  studentId: string;
  locale: string;
}) {
  const locale = isLocale(input.locale) ? input.locale : 'en';
  const profile = await requireProfile(locale, 'ADMIN');
  const batchId = databaseUuid.safeParse(input.batchId);
  const studentId = databaseUuid.safeParse(input.studentId);

  if (!batchId.success || !studentId.success) {
    return {ok: false as const};
  }

  try {
    const classCycle = await getClassReportCycleWorkspace(batchId.data);
    if (!classCycle) return {ok: false as const};

    let snapshot: ReportSnapshotV2 | null = null;

    if (classCycle.batch.status === 'FINALIZED') {
      const reportRow = classCycle.reports.find(
        (report) => report.studentId === studentId.data
      );
      const report = reportRow
        ? await getReport(profile.schoolId, reportRow.id)
        : null;

      snapshot = report?.snapshot.version === 2
        ? report.snapshot
        : null;
    } else {
      const live = await getClassReportCycleLivePreview(
        profile.schoolId,
        batchId.data,
        studentId.data
      );
      snapshot = live?.snapshot ?? null;
    }

    if (!snapshot) return {ok: false as const};

    const recipients = await getClassReportPreviewRecipients(
      profile.schoolId,
      studentId.data
    );

    return {
      ok: true as const,
      preview: {
        studentId: studentId.data,
        recipients: recipients.map(({email}) => email),
        subject: renderReportEmailSubject(snapshot),
        html: renderReportEmail(snapshot)
      }
    };
  } catch (error) {
    console.error('Unable to refresh Class Report Cycle email preview', {
      error
    });
    return {ok: false as const};
  }
}
