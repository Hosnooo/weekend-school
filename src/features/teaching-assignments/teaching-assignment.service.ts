import type {
  EffectiveTeachingContext,
  TeachingAssignment,
  TeachingClassSubject
} from '@/features/teaching-assignments/teaching-assignment.types';

function effectiveOn(assignment: TeachingAssignment, onDate: string) {
  return assignment.startsOn <= onDate &&
    (assignment.endsOn === null || assignment.endsOn >= onDate);
}

export function validateTeachingAssignmentDateRange(startsOn: string, endsOn: string | null) {
  if (endsOn !== null && endsOn < startsOn) {
    throw new Error('End date cannot be before start date');
  }
  return {startsOn, endsOn};
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
