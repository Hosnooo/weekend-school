export type DashboardGroup = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  submitted: boolean;
};

export function selectDashboardWork(
  requests: Array<{id: string; periodStart: string; openCount: number}>,
  cycles: Array<{id: string; status: 'DRAFT' | 'REVIEW' | 'FINALIZED'}>,
  today: string
) {
  return {
    openRequestIds: requests
      .filter((request) => request.openCount > 0 && request.periodStart <= today)
      .map((request) => request.id),
    activeCycleIds: cycles
      .filter((cycle) => cycle.status !== 'FINALIZED')
      .map((cycle) => cycle.id)
  };
}

type TeachingUpdateContext = {
  teacherId: string;
  classSubjectId: string;
  subjectGroupId: string | null;
};

type TeachingUpdateSubmission = TeachingUpdateContext & {
  status: 'DRAFT' | 'SUBMITTED';
};

export type DashboardTeachingUpdate = TeachingUpdateContext & {
  status: 'MISSING' | 'DRAFT' | 'SUBMITTED';
};

type AttendanceConflictContext = {
  classSubjectId: string;
  subjectGroupId: string | null;
  weekStart: string;
  studentId: string;
};

type AttendanceObservation = AttendanceConflictContext & {
  status: 'PRESENT' | 'ABSENT';
};

type TeacherAttentionTeacher = {
  id: string;
  hasLogin: boolean;
};

type TeacherAttentionAssignment = {
  teacherId: string;
  startsOn: string;
  endsOn: string | null;
};

export function summarizeReportDelivery(
  reports: Array<{status: string}>,
  deliveries: Array<{status: string}>
) {
  return {
    readyReports: reports.filter((report) => report.status === 'READY').length,
    failedDeliveries: deliveries.filter(
      (delivery) => delivery.status === 'FAILED'
    ).length
  };
}

export function summarizeTeacherAttention(
  teachers: TeacherAttentionTeacher[],
  assignments: TeacherAttentionAssignment[],
  onDate: string
) {
  const currentlyAssignedTeacherIds = new Set(
    assignments
      .filter(
        (assignment) =>
          assignment.startsOn <= onDate &&
          (assignment.endsOn === null || assignment.endsOn >= onDate)
      )
      .map((assignment) => assignment.teacherId)
  );

  return {
    teachersWithoutLogin: teachers.filter((teacher) => !teacher.hasLogin).length,
    teachersWithoutAssignments: teachers.filter(
      (teacher) => !currentlyAssignedTeacherIds.has(teacher.id)
    ).length
  };
}

export function schoolWeekForDate(localDate: string) {
  const date = new Date(`${localDate}T12:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;

  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  const start = date.toISOString().slice(0, 10);

  date.setUTCDate(date.getUTCDate() + 6);

  return {
    start,
    end: date.toISOString().slice(0, 10)
  };
}

export function summarizeGroupSubmissions(
  activeGroups: Array<{
    id: string;
    nameEn: string;
    nameAr: string | null;
  }>,
  submittedSessions: Array<{group_id: string}>
) {
  const submittedIds = new Set(
    submittedSessions.map((session) => session.group_id)
  );

  const groups = activeGroups.map((group) => ({
    ...group,
    submitted: submittedIds.has(group.id)
  }));

  return {
    submittedCount: groups.filter((group) => group.submitted).length,
    groups
  };
}

const teachingUpdateKey = (context: TeachingUpdateContext) =>
  `${context.teacherId}:${context.classSubjectId}:${context.subjectGroupId ?? 'whole'}`;

export function summarizeTeachingUpdates(
  expectedContexts: TeachingUpdateContext[],
  submissions: TeachingUpdateSubmission[]
) {
  const expectedByKey = new Map<string, TeachingUpdateContext>();

  for (const context of expectedContexts) {
    const key = teachingUpdateKey(context);

    if (!expectedByKey.has(key)) {
      expectedByKey.set(key, context);
    }
  }

  const submissionByKey = new Map(
    submissions.map((submission) => [
      teachingUpdateKey(submission),
      submission.status
    ])
  );

  const contexts = [...expectedByKey.values()].map((context) => ({
    ...context,
    status:
      submissionByKey.get(teachingUpdateKey(context)) ??
      ('MISSING' as const)
  }));

  return {
    expectedCount: contexts.length,
    submittedCount: contexts.filter(({status}) => status === 'SUBMITTED').length,
    draftCount: contexts.filter(({status}) => status === 'DRAFT').length,
    missingCount: contexts.filter(({status}) => status === 'MISSING').length,
    contexts
  };
}

const attendanceConflictKey = (context: AttendanceConflictContext) =>
  `${context.classSubjectId}:${context.subjectGroupId ?? 'whole'}:${context.weekStart}:${context.studentId}`;

export function countUnresolvedAttendanceConflicts(
  observations: AttendanceObservation[],
  resolutions: AttendanceConflictContext[]
) {
  const statusesByKey = new Map<string, Set<'PRESENT' | 'ABSENT'>>();

  for (const observation of observations) {
    const key = attendanceConflictKey(observation);
    const statuses =
      statusesByKey.get(key) ?? new Set<'PRESENT' | 'ABSENT'>();

    statuses.add(observation.status);
    statusesByKey.set(key, statuses);
  }

  const resolvedKeys = new Set(resolutions.map(attendanceConflictKey));

  return [...statusesByKey.entries()].filter(
    ([key, statuses]) => statuses.size > 1 && !resolvedKeys.has(key)
  ).length;
}

export function summarizeActionableDashboard({
  expectedContexts,
  submissions,
  observations,
  resolutions
}: {
  expectedContexts: TeachingUpdateContext[];
  submissions: TeachingUpdateSubmission[];
  observations: AttendanceObservation[];
  resolutions: AttendanceConflictContext[];
}) {
  return {
    ...summarizeTeachingUpdates(expectedContexts, submissions),
    unresolvedAttendanceConflicts: countUnresolvedAttendanceConflicts(
      observations,
      resolutions
    )
  };
}
