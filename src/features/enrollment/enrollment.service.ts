import type {
  ClassChangePlan,
  ClassEnrollmentHistoryItem,
  EnrollmentClassSubject,
  EnrollmentGroupMembership,
  EnrollmentSubjectExclusion,
  SubjectParticipation
} from '@/features/enrollment/enrollment.types';

function includesDate(startsOn: string, endsOn: string | null, onDate: string) {
  return startsOn <= onDate && (endsOn === null || endsOn >= onDate);
}

function previousDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

function activeMembershipFor(
  memberships: EnrollmentGroupMembership[],
  classSubjectId: string,
  onDate: string
) {
  return memberships.find(
    (membership) =>
      membership.classSubjectId === classSubjectId &&
      includesDate(membership.startsOn, membership.endsOn, onDate)
  );
}

function isExcluded(
  exclusions: EnrollmentSubjectExclusion[],
  classSubjectId: string,
  onDate: string
) {
  return exclusions.some(
    (exclusion) =>
      exclusion.classSubjectId === classSubjectId &&
      includesDate(exclusion.startsOn, exclusion.endsOn, onDate)
  );
}

export function deriveSubjectParticipation({
  classSubjects,
  exclusions,
  memberships,
  onDate
}: {
  classSubjects: EnrollmentClassSubject[];
  exclusions: EnrollmentSubjectExclusion[];
  memberships: EnrollmentGroupMembership[];
  onDate: string;
}): SubjectParticipation[] {
  return classSubjects
    .filter(({isActive}) => isActive)
    .map((subject) => {
      const excluded = isExcluded(exclusions, subject.id, onDate);
      const activeGroups = subject.groups.filter(({isActive}) => isActive);
      const currentMembership = activeMembershipFor(memberships, subject.id, onDate);

      if (excluded) {
        return {
          classSubjectId: subject.id,
          nameEn: subject.nameEn,
          nameAr: subject.nameAr,
          included: false,
          subjectGroupId: null,
          assignmentNeeded: false
        };
      }

      if (activeGroups.length === 0) {
        return {
          classSubjectId: subject.id,
          nameEn: subject.nameEn,
          nameAr: subject.nameAr,
          included: true,
          subjectGroupId: null,
          assignmentNeeded: false
        };
      }

      if (
        currentMembership &&
        activeGroups.some(({id}) => id === currentMembership.subjectGroupId)
      ) {
        return {
          classSubjectId: subject.id,
          nameEn: subject.nameEn,
          nameAr: subject.nameAr,
          included: true,
          subjectGroupId: currentMembership.subjectGroupId,
          assignmentNeeded: false
        };
      }

      const defaultGroupId = activeGroups.some(({id}) => id === subject.defaultGroupId)
        ? subject.defaultGroupId
        : null;

      return {
        classSubjectId: subject.id,
        nameEn: subject.nameEn,
        nameAr: subject.nameAr,
        included: true,
        subjectGroupId: defaultGroupId,
        assignmentNeeded: defaultGroupId === null
      };
    });
}

export function moveSubjectGroupMembership(
  memberships: EnrollmentGroupMembership[],
  move: Omit<EnrollmentGroupMembership, 'endsOn'>
): EnrollmentGroupMembership[] {
  const endsOn = previousDate(move.startsOn);
  const next = memberships.map((membership) => {
    if (
      membership.classSubjectId === move.classSubjectId &&
      membership.endsOn === null &&
      membership.startsOn < move.startsOn
    ) {
      return {...membership, endsOn};
    }
    return membership;
  });

  next.push({...move, endsOn: null});
  return next;
}

export function planClassChange({
  currentEnrollment,
  currentMemberships,
  targetClassId,
  targetClassSubjects,
  excludedClassSubjectIds,
  startsOn
}: {
  currentEnrollment: ClassEnrollmentHistoryItem;
  currentMemberships: EnrollmentGroupMembership[];
  targetClassId: string;
  targetClassSubjects: EnrollmentClassSubject[];
  excludedClassSubjectIds: string[];
  startsOn: string;
}): ClassChangePlan {
  const endsOn = previousDate(startsOn);
  const excluded = new Set(excludedClassSubjectIds);

  const endedEnrollment = {...currentEnrollment, endsOn};
  const endedMemberships = currentMemberships.map((membership) =>
    membership.endsOn === null ? {...membership, endsOn} : membership
  );
  const newEnrollment = {classId: targetClassId, startsOn, endsOn: null};
  const newMemberships = targetClassSubjects.flatMap((subject) => {
    if (!subject.isActive || excluded.has(subject.id)) return [];

    const activeGroups = subject.groups.filter(({isActive}) => isActive);
    if (activeGroups.length === 0) return [];

    const defaultGroupId = activeGroups.some(({id}) => id === subject.defaultGroupId)
      ? subject.defaultGroupId
      : null;
    if (!defaultGroupId) return [];

    return [{
      classSubjectId: subject.id,
      subjectGroupId: defaultGroupId,
      startsOn,
      endsOn: null
    }];
  });

  return {endedEnrollment, endedMemberships, newEnrollment, newMemberships};
}
