import type {
  EffectiveTeachingContext,
  TeachingAssignment,
  TeachingClassSubject
} from '@/features/teaching-assignments/teaching-assignment.types';

function effectiveOn(assignment: TeachingAssignment, onDate: string) {
  return assignment.startsOn <= onDate &&
    (assignment.endsOn === null || assignment.endsOn >= onDate);
}

export function expandEffectiveTeachingContexts({
  teacherProfileId,
  assignments,
  classSubjects,
  onDate
}: {
  teacherProfileId: string;
  assignments: TeachingAssignment[];
  classSubjects: TeachingClassSubject[];
  onDate: string;
}): EffectiveTeachingContext[] {
  const subjectById = new Map(classSubjects
    .filter((subject) => subject.isActive !== false)
    .map((subject) => [subject.id, subject]));
  const contexts = new Map<string, EffectiveTeachingContext>();

  for (const assignment of assignments) {
    if (assignment.teacherProfileId !== teacherProfileId || !effectiveOn(assignment, onDate)) continue;
    const subject = subjectById.get(assignment.classSubjectId);
    if (!subject) continue;

    const groups = subject.groups.filter(({isActive}) => isActive);
    if (assignment.subjectGroupId === null) {
      if (groups.length === 0) {
        contexts.set(`${subject.id}:whole`, {
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
        contexts.set(`${subject.id}:${group.id}`, {
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
    contexts.set(`${subject.id}:${group.id}`, {
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

  return [...contexts.values()].sort((left, right) =>
    left.classNameEn.localeCompare(right.classNameEn) ||
    left.subjectNameEn.localeCompare(right.subjectNameEn) ||
    (left.groupNameEn ?? '').localeCompare(right.groupNameEn ?? '')
  );
}
