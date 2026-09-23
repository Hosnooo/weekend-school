import type {StudentListItem} from './student.types';

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
export function filterStudents(students: StudentListItem[], query: string): StudentListItem[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return students;
  return students.filter((student) => [
    student.firstNameEn, student.lastNameEn, student.firstNameAr, student.lastNameAr,
    `${student.firstNameEn} ${student.lastNameEn}`,
    `${student.firstNameAr ?? ''} ${student.lastNameAr ?? ''}`
  ].some((value) => value?.toLocaleLowerCase().includes(term)));
}
