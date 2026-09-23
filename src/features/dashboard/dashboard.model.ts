export type DashboardGroup = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  submitted: boolean;
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

export function summarizeTeachingUpdates() {
  return {expectedCount: 0, submittedCount: 0, draftCount: 0, missingCount: 0, contexts: []};
}
