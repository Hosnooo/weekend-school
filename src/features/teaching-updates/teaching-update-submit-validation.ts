import type {TeachingUpdate, TeachingUpdateCoverageKind} from './teaching-update.types';

export type SubmitIssueCode =
  | 'unsaved' | 'noStudents' | 'invalidCoverage' | 'noDates'
  | 'futureCoverage' | 'missingBoth' | 'missingAttended'
  | 'missingTotal' | 'invalidAttended' | 'invalidTotal'
  | 'attendedExceedsTotal';

export type SubmitIssue = {code: SubmitIssueCode; studentId?: string};

export type SubmitReadinessInput = {
  coverageKind: TeachingUpdateCoverageKind;
  periodStart: string;
  periodEnd: string;
  dates: string[];
  today: string;
  roster: Pick<TeachingUpdate['roster'][number], 'id'>[];
  attendance: Pick<TeachingUpdate['attendance'][number], 'studentId' | 'attended' | 'total'>[];
  unsaved: boolean;
};

/** Partial drafts are allowed; these checks apply only to final submission. */
export function getTeachingUpdateSubmitIssues(input: SubmitReadinessInput): SubmitIssue[] {
  const issues: SubmitIssue[] = [];
  if (input.unsaved) issues.push({code: 'unsaved'});
  if (input.roster.length === 0) issues.push({code: 'noStudents'});
  if (!input.periodStart || !input.periodEnd || input.periodStart > input.periodEnd) {
    issues.push({code: 'invalidCoverage'});
  } else if (input.periodEnd > input.today) {
    issues.push({code: 'futureCoverage'});
  }
  if (input.coverageKind === 'DATES') {
    if (input.dates.length === 0) issues.push({code: 'noDates'});
    else if (input.dates.some(date => date > input.today) &&
             !issues.some(issue => issue.code === 'futureCoverage')) {
      issues.push({code: 'futureCoverage'});
    }
  }
  for (const student of input.roster) {
    const row = input.attendance.find(item => item.studentId === student.id);
    const attended = row?.attended ?? null;
    const total = row?.total ?? null;
    if (attended === null && total === null) {
      issues.push({code: 'missingBoth', studentId: student.id});
      continue;
    }
    if (attended === null) {
      issues.push({code: 'missingAttended', studentId: student.id});
    } else if (!Number.isInteger(attended) || attended < 0) {
      issues.push({code: 'invalidAttended', studentId: student.id});
    }
    if (total === null) {
      issues.push({code: 'missingTotal', studentId: student.id});
    } else if (!Number.isInteger(total) || total <= 0) {
      issues.push({code: 'invalidTotal', studentId: student.id});
    }
    if (attended !== null && total !== null &&
        Number.isInteger(attended) && Number.isInteger(total) &&
        attended >= 0 && total > 0 && attended > total) {
      issues.push({code: 'attendedExceedsTotal', studentId: student.id});
    }
  }
  return issues;
}
