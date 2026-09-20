export type GroupListItem = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  parentGroupId: string | null;
  isActive: boolean;
  primaryTeacher: {id: string; displayName: string} | null;
  currentStudentCount: number;
};

export type GroupMembershipListItem = {
  id: string;
  studentId: string;
  studentNameEn: string;
  studentNameAr: string | null;
  startsOn: string;
  endsOn: string | null;
};
