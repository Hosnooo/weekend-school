export type StudentGroup = {id: string; nameEn: string; nameAr: string | null};

export type DatedStudentMembership = {
  startsOn: string;
  endsOn: string | null;
  group: StudentGroup | null;
};

export function currentGroupForDate(
  memberships: DatedStudentMembership[],
  date: string
): StudentGroup | null {
  const effective = memberships.filter((membership) =>
    membership.startsOn <= date &&
    (membership.endsOn === null || membership.endsOn >= date)
  );
  if (effective.length > 1) {
    throw new Error('A student has overlapping group memberships');
  }
  return effective[0]?.group ?? null;
}
