export type ReportAttendanceSource = {
  id: string;
  weekStart: string;
  coverageKind?: 'RANGE' | 'DATES';
  periodStart?: string;
  periodEnd?: string;
  coveredDates?: string[];
  partialOverlap?: boolean;
};

export type ReportAttendanceObservation = {
  submissionId: string;
  studentId: string;
  /** Retained for the audit trail of historical records only. */
  attendanceStatus: 'PRESENT' | 'ABSENT' | null;
  attended?: number | null;
  total?: number | null;
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

function coveredIntervals(source: ReportAttendanceSource): Array<[string, string]> {
  if (source.coverageKind === 'DATES' && source.coveredDates?.length) {
    return source.coveredDates.map((date) => [date, date]);
  }
  return [[source.periodStart ?? source.weekStart, source.periodEnd ?? source.weekStart]];
}

function intersects(a: ReportAttendanceSource, b: ReportAttendanceSource) {
  return coveredIntervals(a).some(([aStart, aEnd]) =>
    coveredIntervals(b).some(([bStart, bEnd]) =>
      aStart <= bEnd && bStart <= aEnd
    )
  );
}

/**
 * Resolve legacy weekly statuses and new actual-session counts together.
 * Count non-overlapping numeric submissions only. Overlapping sources,
 * even if they agree numerically, require Admin review: summing would
 * fabricate attendance. A saved Admin pair still wins downstream.
 */
export function deriveReportAttendance(input: {
  sources: ReportAttendanceSource[];
  observations: ReportAttendanceObservation[];
  resolutions: ReportAttendanceResolution[];
  classSubjectId: string;
  subjectGroupId: string | null;
  studentId: string;
}): DerivedReportAttendance {
  const available = input.sources.flatMap((source) => {
    const observation = input.observations.find((row) =>
      row.submissionId === source.id && row.studentId === input.studentId
    );
    return observation ? [{source, observation}] : [];
  });

  const numeric = available.filter(({observation}) =>
    observation.attended !== null &&
    observation.attended !== undefined &&
    observation.total !== null &&
    observation.total !== undefined
  );
  const legacy = available.filter(({observation}) =>
    observation.attendanceStatus !== null
  );

  const numericConflicts = new Set<string>();
  const legacyConflicts = new Set<string>();
  for (const {source} of numeric) {
    if (source.partialOverlap) numericConflicts.add(source.id);
    for (const other of numeric) {
      if (source.id !== other.source.id && intersects(source, other.source)) {
        numericConflicts.add(source.id);
        numericConflicts.add(other.source.id);
      }
    }
    for (const other of legacy) {
      if (intersects(source, other.source)) {
        numericConflicts.add(source.id);
        legacyConflicts.add(other.source.id);
      }
    }
  }

  let attended = 0;
  let total = 0;
  // Count each overlapping numeric source-group once, not once per pair.
  let unresolvedConflicts = 0;
  const unresolvedNumeric = new Set(numericConflicts);
  while (unresolvedNumeric.size > 0) {
    const firstId = unresolvedNumeric.values().next().value!;
    const component = new Set([firstId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const a of numeric) {
        if (!component.has(a.source.id)) continue;
        for (const b of numeric) {
          if (!component.has(b.source.id) && intersects(a.source, b.source)) {
            component.add(b.source.id);
            changed = true;
          }
        }
      }
    }
    for (const id of component) unresolvedNumeric.delete(id);
    unresolvedConflicts += 1;
  }

  for (const {source, observation} of numeric) {
    if (numericConflicts.has(source.id)) continue;
    attended += observation.attended!;
    total += observation.total!;
  }

  const byWeek = new Map<string, Set<'PRESENT' | 'ABSENT'>>();
  for (const {source, observation} of legacy) {
    if (legacyConflicts.has(source.id)) continue;
    const week = byWeek.get(source.weekStart) ?? new Set<'PRESENT' | 'ABSENT'>();
    week.add(observation.attendanceStatus!);
    byWeek.set(source.weekStart, week);
  }
  if (legacyConflicts.size > 0) unresolvedConflicts += 1;

  for (const [weekStart, statuses] of byWeek) {
    let resolved: 'PRESENT' | 'ABSENT' | null =
      statuses.size === 1 ? [...statuses][0]! : null;
    if (!resolved) {
      resolved = input.resolutions.find((item) =>
        item.classSubjectId === input.classSubjectId &&
        item.subjectGroupId === input.subjectGroupId &&
        item.weekStart === weekStart &&
        item.studentId === input.studentId
      )?.resolvedStatus ?? null;
      if (!resolved) unresolvedConflicts += 1;
    }
    if (resolved) {
      total += 1;
      if (resolved === 'PRESENT') attended += 1;
    }
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
