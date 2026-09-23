export type EnrollmentGroup = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  isActive: boolean;
};

export type EnrollmentClassSubject = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  isActive: boolean;
  defaultGroupId: string | null;
  groups: EnrollmentGroup[];
};

export type EnrollmentSubjectExclusion = {
  classSubjectId: string;
  startsOn: string;
  endsOn: string | null;
};

export type EnrollmentGroupMembership = {
  classSubjectId: string;
  subjectGroupId: string;
  startsOn: string;
  endsOn: string | null;
};

export type ClassEnrollmentHistoryItem = {
  classId: string;
  startsOn: string;
  endsOn: string | null;
};

export type SubjectParticipation = {
  classSubjectId: string;
  nameEn: string;
  nameAr: string | null;
  included: boolean;
  subjectGroupId: string | null;
  assignmentNeeded: boolean;
};

export type ClassChangePlan = {
  endedEnrollment: ClassEnrollmentHistoryItem;
  endedMemberships: EnrollmentGroupMembership[];
  newEnrollment: ClassEnrollmentHistoryItem;
  newMemberships: EnrollmentGroupMembership[];
};
