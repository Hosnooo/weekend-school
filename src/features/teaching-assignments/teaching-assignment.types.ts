export type TeachingGroup = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  isActive: boolean;
};

export type TeachingClassSubject = {
  id: string;
  classNameEn: string;
  classNameAr: string | null;
  subjectNameEn: string;
  subjectNameAr: string | null;
  isActive?: boolean;
  groups: TeachingGroup[];
};

export type TeachingAssignment = {
  id: string;
  teacherProfileId: string;
  classSubjectId: string;
  subjectGroupId: string | null;
  startsOn: string;
  endsOn: string | null;
};

export type EffectiveTeachingContext = {
  classSubjectId: string;
  subjectGroupId: string | null;
  classNameEn: string;
  classNameAr: string | null;
  subjectNameEn: string;
  subjectNameAr: string | null;
  groupNameEn: string | null;
  groupNameAr: string | null;
};
