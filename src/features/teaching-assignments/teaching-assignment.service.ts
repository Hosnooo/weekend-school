import type {
  EffectiveTeachingContext,
  TeachingAssignment,
  TeachingAssignmentMutationError,
  TeachingClassSubject
} from '@/features/teaching-assignments/teaching-assignment.types';

type PersistenceError = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

export class TeachingAssignmentMutationException extends Error {
  constructor(
    public readonly kind: TeachingAssignmentMutationError,
    message: string
  ) {
    super(message);
    this.name = 'TeachingAssignmentMutationException';
  }
}

function effectiveOn(assignment: TeachingAssignment, onDate: string) {
  return assignment.startsOn <= onDate &&
    (assignment.endsOn === null || assignment.endsOn >= onDate);
}

function errorText(error: PersistenceError) {
  return [error.message, error.details]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function addIsoDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year!, month! - 1, day! + days));
  return value.toISOString().slice(0, 10);
}

export function classifyTeachingAssignmentMutationError(
  error: unknown
): TeachingAssignmentMutationError {
  if (error instanceof TeachingAssignmentMutationException) return error.kind;
  if (!error || typeof error !== 'object') return 'unexpected';

  const persistenceError = error as PersistenceError;
  const code = typeof persistenceError.code === 'string' ? persistenceError.code : '';
  const text = errorText(persistenceError);

  if (code === '23P01' || text.includes('teaching_assignments_no_duplicate_overlap')) {
    return 'overlap';
  }
  if (code === '42501') return 'forbidden';
  if (code === 'P0002' || code === '23503') return 'not-found';
  if (code === '23514' && text.includes('submitted teaching history')) {
    return 'protected-history';
  }
  if (
    code === '23514' &&
    (text.includes('end date') || text.includes('date range') || text.includes('before start date'))
  ) {
    return 'invalid-range';
  }

  return 'unexpected';
}

export function validateTeachingAssignmentDateRange(startsOn: string, endsOn: string | null) {
  if (endsOn !== null && endsOn < startsOn) {
    throw new TeachingAssignmentMutationException(
      'invalid-range',
      'End date cannot be before start date'
    );
  }
  return {startsOn, endsOn};
}

export function teachingAssignmentProtectsSubmittedHistory(
  assignment: TeachingAssignment,
  submission: {
    classSubjectId: string;
    subjectGroupId: string | null;
    weekStart: string;
  }
) {
  if (assignment.classSubjectId !== submission.classSubjectId) return false;
  if (
    assignment.subjectGroupId !== null &&
    assignment.subjectGroupId !== submission.subjectGroupId
  ) {
    return false;
  }

  const weekEnd = addIsoDays(submission.weekStart, 6);
  return assignment.startsOn <= weekEnd &&
    (assignment.endsOn === null || assignment.endsOn >= submission.weekStart);
}

export function classifyTeachingAssignments(assignments: TeachingAssignment[], onDate: string) {
  const current: TeachingAssignment[] = [];
  const upcoming: TeachingAssignment[] = [];
  const past: TeachingAssignment[] = [];

  for (const assignment of assignments) {
    if (assignment.startsOn > onDate) upcoming.push(assignment);
    else if (assignment.endsOn !== null && assignment.endsOn < onDate) past.push(assignment);
    else current.push(assignment);
  }

  return {current, upcoming, past};
}

export function expandEffectiveTeachingContexts({
  teacherId,
  assignments,
  classSubjects,
  onDate
}: {
  teacherId: string;
  assignments: TeachingAssignment[];
  classSubjects: TeachingClassSubject[];
  onDate: string;
}): EffectiveTeachingContext[] {
  const subjectById = new Map(classSubjects
    .filter((subject) => subject.isActive !== false)
    .map((subject) => [subject.id, subject]));
  const contexts = new Map<string, EffectiveTeachingContext>();

  for (const assignment of assignments) {
    if (assignment.teacherId !== teacherId || !effectiveOn(assignment, onDate)) continue;
    const subject = subjectById.get(assignment.classSubjectId);
    if (!subject) continue;

    const groups = subject.groups.filter(({isActive}) => isActive);
    if (assignment.subjectGroupId === null) {
      if (groups.length === 0) {
        contexts.set(`${teacherId}:${subject.id}:whole`, {
          teacherId,
          classSubjectId: subject.id,
          subjectGroupId: null,
          classNameEn: subject.classNameEn,
          classNameAr: subject.classNameAr,
          subjectNameEn: subject.subjectNameEn,
          subjectNameAr: subject.subjectNameAr,
          groupNameEn: null,
          groupNameAr: null
        });
        continue;
      }

      for (const group of groups) {
        contexts.set(`${teacherId}:${subject.id}:${group.id}`, {
          teacherId,
          classSubjectId: subject.id,
          subjectGroupId: group.id,
          classNameEn: subject.classNameEn,
          classNameAr: subject.classNameAr,
          subjectNameEn: subject.subjectNameEn,
          subjectNameAr: subject.subjectNameAr,
          groupNameEn: group.nameEn,
          groupNameAr: group.nameAr
        });
      }
      continue;
    }

    const group = groups.find(({id}) => id === assignment.subjectGroupId);
    if (!group) continue;
    contexts.set(`${teacherId}:${subject.id}:${group.id}`, {
      teacherId,
      classSubjectId: subject.id,
      subjectGroupId: group.id,
      classNameEn: subject.classNameEn,
      classNameAr: subject.classNameAr,
      subjectNameEn: subject.subjectNameEn,
      subjectNameAr: subject.subjectNameAr,
      groupNameEn: group.nameEn,
      groupNameAr: group.nameAr
    });
  }

  return [...contexts.values()];
}
