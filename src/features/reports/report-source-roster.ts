export type ReportSourceRosterObservation = {
  submissionId: string;
  studentId: string;
};

export function studentBelongsToReportContext(input: {
  studentId: string;
  subjectGroupId: string | null;
  selectedSourceIds: Iterable<string>;
  observations: readonly ReportSourceRosterObservation[];
  currentMembership: boolean;
}) {
  if (input.subjectGroupId === null) return true;

  const selectedSourceIds = new Set(input.selectedSourceIds);
  const sourceRoster = input.observations.filter(({submissionId}) =>
    selectedSourceIds.has(submissionId)
  );

  if (sourceRoster.length > 0) {
    return sourceRoster.some(({studentId}) => studentId === input.studentId);
  }

  return input.currentMembership;
}

/** Effective-date selection for each student, used in editing and final reports.
 * Source text and attendance must not leak across enrollment/group boundaries.
 */
type DatedStudentRow = {
  student_id: string;
  starts_on: string;
  ends_on: string | null;
};

type SubjectGroupRow = DatedStudentRow & {
  class_subject_id: string;
  subject_group_id: string;
};

type SubjectExclusionRow = DatedStudentRow & {
  class_subject_id: string;
};

type DatedSource = {
  coverageKind: 'RANGE' | 'DATES';
  periodStart: string;
  periodEnd: string;
  coveredDates: string[];
};

function nextIsoDate(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function hasUnexcludedDate(
  start: string,
  end: string,
  exclusions: readonly SubjectExclusionRow[]
) {
  let firstAvailable = start;
  const sortedExclusions = [...exclusions].sort((a, b) =>
    a.starts_on.localeCompare(b.starts_on)
  );
  for (const excluded of sortedExclusions) {
    if (excluded.starts_on > end) break;
    if (excluded.ends_on && excluded.ends_on < firstAvailable) continue;
    if (excluded.starts_on > firstAvailable) return true;
    const excludedEnd = excluded.ends_on ?? end;
    if (excludedEnd >= end) return false;
    const afterExclusion = nextIsoDate(excludedEnd);
    if (afterExclusion > firstAvailable) firstAvailable = afterExclusion;
    if (firstAvailable > end) return false;
  }
  return firstAvailable <= end;
}

export function eligibleReportSourcesForStudent<T extends DatedSource>(input: {
  studentId: string;
  classSubjectId: string;
  subjectGroupId: string | null;
  reportStart: string;
  reportEnd: string;
  sources: readonly T[];
  enrollments: readonly DatedStudentRow[];
  memberships: readonly SubjectGroupRow[];
  exclusions: readonly SubjectExclusionRow[];
}): T[] {
  const studentEnrollments = input.enrollments.filter(
    (row) => row.student_id === input.studentId
  );
  const groupMemberships = input.subjectGroupId === null
    ? [null]
    : input.memberships.filter(
        (row) =>
          row.student_id === input.studentId &&
          row.class_subject_id === input.classSubjectId &&
          row.subject_group_id === input.subjectGroupId
      );
  const exclusions = input.exclusions.filter(
    (row) =>
      row.student_id === input.studentId &&
      row.class_subject_id === input.classSubjectId
  );

  return input.sources.filter((source) => {
    for (const enrollment of studentEnrollments) {
      for (const membership of groupMemberships) {
        const starts = [
          input.reportStart,
          source.periodStart,
          enrollment.starts_on,
          ...(membership ? [membership.starts_on] : [])
        ];
        const ends = [
          input.reportEnd,
          source.periodEnd,
          enrollment.ends_on ?? '9999-12-31',
          ...(membership ? [membership.ends_on ?? '9999-12-31'] : [])
        ];
        const start = starts.sort().at(-1)!;
        const end = ends.sort()[0]!;
        if (start > end) continue;

        if (source.coverageKind === 'DATES') {
          if (source.coveredDates.some(
            (date) =>
              date >= start &&
              date <= end &&
              !exclusions.some(
                (excluded) =>
                  excluded.starts_on <= date &&
                  (excluded.ends_on === null || excluded.ends_on >= date)
              )
          )) {
            return true;
          }
        } else if (hasUnexcludedDate(start, end, exclusions)) {
          return true;
        }
      }
    }
    return false;
  });
}
