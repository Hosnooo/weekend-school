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
  groups: SubjectGroupSummary[];
};

export type ClassSummary = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  isActive: boolean;
  subjectCount: number;
};

export type ClassDetail = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  isActive: boolean;
  subjects: ClassSubjectSummary[];
};
