/**
 * A re-finalized Class Report Cycle retains earlier immutable snapshots.
 * Only its most recent revision for each student belongs in the current
 * report selector and email preview.
 *
 * Revisions are monotonically increasing for the same student and period.
 * On equal revisions, retain the first row (caller-specified ordering).
 */
export function selectLatestReportRevisionsByStudent<
  T extends {student_id: string; revision: number}
>(reports: readonly T[]): T[] {
  const latest = new Map<string, T>();

  for (const report of reports) {
    const previous = latest.get(report.student_id);
    if (!previous || report.revision > previous.revision) {
      latest.set(report.student_id, report);
    }
  }

  return [...latest.values()];
}
