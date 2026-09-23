export type DashboardGroup = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  submitted: boolean;
};

type TeachingUpdateContext = {
  teacherProfileId: string;
  classSubjectId: string;
  subjectGroupId: string | null;
};

type TeachingUpdateSubmission = TeachingUpdateContext & {
  status: 'DRAFT' | 'SUBMITTED';
};

export type DashboardTeachingUpdate = TeachingUpdateContext & {
  status: 'MISSING' | 'DRAFT' | 'SUBMITTED';
};

export function summarizeReportDelivery(
  reports: Array<{status: string}>,
  deliveries: Array<{status: string}>
): {readyReports: number; failedDeliveries: number} {
  return {
    readyReports: reports.filter((report) => report.status === 'READY').length,
    failedDeliveries: deliveries.filter((delivery) => delivery.status === 'FAILED').length
  };
}

export function schoolWeekForDate(localDate: string) {
  const date = new Date(`${localDate}T12:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  const start = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return {start, end: date.toISOString().slice(0, 10)};
}

export function summarizeGroupSubmissions(
  activeGroups: Array<{id: string; nameEn: string; nameAr: string | null}>,
  submittedSessions: Array<{group_id: string}>
): {submittedCount: number; groups: DashboardGroup[]} {
  const submittedIds = new Set(submittedSessions.map((session) => session.group_id));
  const groups = activeGroups.map((group) => ({...group, submitted: submittedIds.has(group.id)}));
  return {submittedCount: groups.filter((group) => group.submitted).length, groups};
}

function teachingUpdateKey(context: TeachingUpdateContext) {
  return `${context.teacherProfileId}:${context.classSubjectId}:${context.subjectGroupId ?? 'whole'}`;
}

export function summarizeTeachingUpdates(
  expectedContexts: TeachingUpdateContext[],
  submissions: TeachingUpdateSubmission[]
): {
  expectedCount: number;
  submittedCount: number;
  draftCount: number;
  missingCount: number;
  contexts: DashboardTeachingUpdate[];
} {
  const expectedByKey = new Map<string, TeachingUpdateContext>();
  for (const context of expectedContexts) {
    const key = teachingUpdateKey(context);
    if (!expectedByKey.has(key)) expectedByKey.set(key, context);
  }

  const submissionByKey = new Map(
    submissions.map((submission) => [teachingUpdateKey(submission), submission.status])
  );
  const contexts = [...expectedByKey.values()].map((context) => ({
    ...context,
    status: submissionByKey.get(teachingUpdateKey(context)) ?? 'MISSING' as const
  }));

  return {
    expectedCount: contexts.length,
    submittedCount: contexts.filter(({status}) => status === 'SUBMITTED').length,
    draftCount: contexts.filter(({status}) => status === 'DRAFT').length,
    missingCount: contexts.filter(({status}) => status === 'MISSING').length,
    contexts
  };
}
