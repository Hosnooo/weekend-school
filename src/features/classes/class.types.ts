export type SubjectOption = {
  id: string;
  nameEn: string;
  nameAr: string | null;
};

export type SubjectGroupSummary = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  isActive: boolean;
  isDefault: boolean;
};

export type ClassSubjectSummary = {
  id: string;
  subjectId: string;
  subjectNameEn: string;
  subjectNameAr: string | null;
  isActive: boolean;
  defaultGroupId: string | null;
  teacherCount: number;
  groups: SubjectGroupSummary[];
};

export type ClassSummary = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
  activeStudentCount: number;
  subjectCount: number;
};

export type ClassDetail = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
  subjects: ClassSubjectSummary[];
};


export type TeacherSubjectGroup = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  isActive: boolean;
};

export type TeacherSubjectStudent = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  currentGroupId: string | null;
};

export type TeacherSubjectMembershipHistory = {
  id: string;
  studentId: string;
  studentNameEn: string;
  studentNameAr: string | null;
  subjectGroupId: string;
  groupNameEn: string;
  groupNameAr: string | null;
  startsOn: string;
  endsOn: string | null;
};

export type TeacherSubjectGroupManagement = {
  classSubjectId: string;
  groups: TeacherSubjectGroup[];
  students: TeacherSubjectStudent[];
  membershipHistory: TeacherSubjectMembershipHistory[];
};
