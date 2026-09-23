import type {
  BuildReportInput,
  BuildReportV2Input,
  ReportIssue,
  ReportLanguage,
  ReportSnapshot,
  ReportSnapshotV2,
  ReportV2Issue
} from './report.types';

export function selectLocalizedText(
  english: string | null,
  arabic: string | null,
  language: ReportLanguage
) {
  const en = english?.trim() || null;
  const ar = arabic?.trim() || null;
  if (language === 'en') return en ? [en] : ar ? [ar] : [];
  if (language === 'ar') return ar ? [ar] : en ? [en] : [];
  return en && ar ? [en, ar] : en ? [en] : ar ? [ar] : [];
}

export function monthPeriod(date: string) {
  const [year, month] = date.split('-').map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    periodStart: `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-01`,
    periodEnd: `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  };
}

type ReportPeriodPreset = 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';
type ReportScope =
  | {type: 'CLASS'}
  | {type: 'SUBJECT'; classSubjectId: string}
  | {type: 'GROUP'; classSubjectId: string; subjectGroupId: string};

type ScopedReportSection = {
  classSubjectId: string;
  subjectGroupId: string | null;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function resolveReportPeriod(input: {
  preset: ReportPeriodPreset;
  today: string;
  customStart?: string;
  customEnd?: string;
}) {
  if (input.preset === 'CUSTOM') {
    if (!input.customStart || !input.customEnd || input.customEnd < input.customStart) {
      throw new Error('A valid custom report period is required');
    }
    return {start: input.customStart, end: input.customEnd};
  }

  const today = parseIsoDate(input.today);
  if (input.preset === 'THIS_WEEK' || input.preset === 'LAST_WEEK') {
    const mondayOffset = (today.getUTCDay() + 6) % 7;
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - mondayOffset - (input.preset === 'LAST_WEEK' ? 7 : 0));
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return {start: isoDate(start), end: isoDate(end)};
  }

  const monthOffset = input.preset === 'LAST_MONTH' ? -1 : 0;
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + monthOffset;
  return {
    start: isoDate(new Date(Date.UTC(year, month, 1))),
    end: isoDate(new Date(Date.UTC(year, month + 1, 0)))
  };
}

export function selectReportSectionsForScope<T extends ScopedReportSection>(
  sections: readonly T[],
  scope: ReportScope
): T[] {
  if (scope.type === 'CLASS') return [...sections];
  if (scope.type === 'SUBJECT') {
    return sections.filter(({classSubjectId}) => classSubjectId === scope.classSubjectId);
  }
  return sections.filter(
    ({classSubjectId, subjectGroupId}) =>
      classSubjectId === scope.classSubjectId && subjectGroupId === scope.subjectGroupId
  );
}

export function buildReportSnapshot(
  input: BuildReportInput
): {snapshot: ReportSnapshot | null; issues: ReportIssue[]} {
  const sessions = input.sessions
    .filter((session) =>
      session.status === 'SUBMITTED' &&
      session.date >= input.period.start &&
      session.date <= input.period.end
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const issues: ReportIssue[] = [];
  if (sessions.length === 0) issues.push('NO_SUBMITTED_SESSIONS');
  if (sessions.some(({attendance}) => attendance === null)) issues.push('INCOMPLETE_ATTENDANCE');
  if (sessions.some(({progressEn, progressAr}) => !progressEn?.trim() && !progressAr?.trim())) {
    issues.push('MISSING_PROGRESS');
  }
  const currentPerformance = sessions
    .map((session) => session.performanceOverride ?? session.defaultPerformance)
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .at(-1) ?? null;
  if (issues.length) return {snapshot: null, issues};
  const uniqueGroups = new Map(sessions.map(({group}) => [group.id, group]));
  const count = (status: NonNullable<(typeof sessions)[number]['attendance']>) =>
    sessions.filter(({attendance}) => attendance === status).length;
  return {
    issues: [],
    snapshot: {
      version: 1,
      school: input.school,
      student: input.student,
      period: input.period,
      language: input.language,
      groups: [...uniqueGroups.values()],
      attendance: {
        present: count('PRESENT'),
        absent: count('ABSENT'),
        late: count('LATE'),
        excused: count('EXCUSED'),
        sessions: sessions.length
      },
      progress: sessions.map((session) => ({
        sessionDate: session.date,
        groupNameEn: session.group.nameEn,
        groupNameAr: session.group.nameAr,
        textEn: session.progressEn,
        textAr: session.progressAr
      })),
      currentPerformance,
      comments: sessions.flatMap((session) =>
        session.commentEn?.trim() || session.commentAr?.trim()
          ? [{sessionDate: session.date, textEn: session.commentEn, textAr: session.commentAr}]
          : []
      ),
      generatedAt: input.generatedAt
    }
  };
}

export function buildReportSnapshotV2(
  input: BuildReportV2Input
): {snapshot: ReportSnapshotV2 | null; issues: ReportV2Issue[]} {
  const issues = input.sections.flatMap((section): ReportV2Issue[] =>
    section.unresolvedAttendanceConflicts > 0
      ? [{code: 'UNRESOLVED_ATTENDANCE_CONFLICT', classSubjectId: section.classSubjectId}]
      : []
  );
  if (issues.length > 0) return {snapshot: null, issues};

  return {
    issues: [],
    snapshot: {
      version: 2,
      school: input.school,
      student: input.student,
      class: input.class,
      period: input.period,
      language: input.language,
      sections: input.sections.map((section) => ({
        classSubjectId: section.classSubjectId,
        subjectNameEn: section.subjectNameEn,
        subjectNameAr: section.subjectNameAr,
        groupNameEn: section.groupNameEn,
        groupNameAr: section.groupNameAr,
        approvedProgressEn: section.approvedProgressEn,
        approvedProgressAr: section.approvedProgressAr,
        performance: section.performance,
        attendance: {...section.attendance},
        commentEn: section.commentEn,
        commentAr: section.commentAr
      })),
      template: {...input.template},
      author: 'MCE Weekend School',
      generatedAt: input.generatedAt
    }
  };
}
