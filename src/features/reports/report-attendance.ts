export type ReportAttendanceSource = {
  id: string;
  weekStart: string;
};

export type ReportAttendanceObservation = {
  submissionId: string;
  studentId: string;
  attendanceStatus: 'PRESENT' | 'ABSENT';
};

export type ReportAttendanceResolution = {
  classSubjectId: string;
  subjectGroupId: string | null;
  weekStart: string;
  studentId: string;
  resolvedStatus: 'PRESENT' | 'ABSENT';
};

export type DerivedReportAttendance = {
  attended: number;
  total: number;
  unresolvedConflicts: number;
};

export type EffectiveReportAttendance = DerivedReportAttendance & {
  overridden: boolean;
};

export function deriveReportAttendance(input: {
  sources: ReportAttendanceSource[];
  observations: ReportAttendanceObservation[];
  resolutions: ReportAttendanceResolution[];
  classSubjectId: string;
  subjectGroupId: string | null;
  studentId: string;
}): DerivedReportAttendance {
  const observationsByWeek = new Map<
    string,
    Set<'PRESENT' | 'ABSENT'>
  >();

  for (const source of input.sources) {
    const observation = input.observations.find(
      (row) =>
        row.submissionId === source.id &&
        row.studentId === input.studentId
    );
    if (!observation) continue;

    const statuses =
      observationsByWeek.get(source.weekStart) ??
      new Set<'PRESENT' | 'ABSENT'>();
    statuses.add(observation.attendanceStatus);
    observationsByWeek.set(source.weekStart, statuses);
  }

  let attended = 0;
  let total = 0;
  let unresolvedConflicts = 0;

  for (const [weekStart, statuses] of observationsByWeek) {
    let official: 'PRESENT' | 'ABSENT' | null =
      statuses.size === 1 ? [...statuses][0]! : null;

    if (statuses.size > 1) {
      official = input.resolutions.find(
        (row) =>
          row.classSubjectId === input.classSubjectId &&
          row.subjectGroupId === input.subjectGroupId &&
          row.weekStart === weekStart &&
          row.studentId === input.studentId
      )?.resolvedStatus ?? null;

      if (!official) unresolvedConflicts += 1;
    }

    if (official) total += 1;
    if (official === 'PRESENT') attended += 1;
  }

  return {attended, total, unresolvedConflicts};
}

export function effectiveReportAttendance(
  source: DerivedReportAttendance,
  attendanceAttended: number | null | undefined,
  attendanceTotal: number | null | undefined
): EffectiveReportAttendance {
  if (
    attendanceAttended !== null &&
    attendanceAttended !== undefined &&
    attendanceTotal !== null &&
    attendanceTotal !== undefined
  ) {
    return {
      attended: attendanceAttended,
      total: attendanceTotal,
      unresolvedConflicts: 0,
      overridden: true
    };
  }

  return {...source, overridden: false};
}

export function reportAttendanceOverride(input: {
  submittedAttended: number | null;
  submittedTotal: number | null;
  sourceAttended: number | null;
  sourceTotal: number | null;
  wasOverridden: boolean;
}) {
  if (
    input.submittedAttended === null ||
    input.submittedTotal === null
  ) {
    return {
      attendanceAttended: null,
      attendanceTotal: null
    };
  }

  if (
    !input.wasOverridden &&
    input.sourceAttended === input.submittedAttended &&
    input.sourceTotal === input.submittedTotal
  ) {
    return {
      attendanceAttended: null,
      attendanceTotal: null
    };
  }

  return {
    attendanceAttended: input.submittedAttended,
    attendanceTotal: input.submittedTotal
  };
}
