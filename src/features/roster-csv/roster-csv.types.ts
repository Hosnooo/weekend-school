export type RosterLanguage = 'en' | 'ar' | 'both';

export type RosterSubjectColumn = {
  id: string;
  nameEn: string;
};

export type ParsedRosterCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type ParsedRosterCsv = {
  headers: string[];
  rows: ParsedRosterCsvRow[];
};

export type RosterIssue = {
  level: 'ERROR' | 'WARNING';
  code: string;
  message: string;
};

export type RosterCatalogGroup = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  isActive: boolean;
};

export type RosterCatalogClassSubject = {
  id: string;
  subjectId: string;
  nameEn: string;
  nameAr: string | null;
  isActive: boolean;
  defaultGroupId: string | null;
  groups: readonly RosterCatalogGroup[];
};

export type RosterCatalogClass = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  isActive: boolean;
  subjects: readonly RosterCatalogClassSubject[];
};

export type RosterCatalogGuardian = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  reportLanguage: RosterLanguage;
  isActive: boolean;
};

export type RosterCatalogStudent = {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  isActive: boolean;
};

export type RosterImportCatalog = {
  defaultLanguage: 'en' | 'ar';
  subjects: readonly {
    id: string;
    nameEn: string;
    nameAr: string | null;
    isActive: boolean;
  }[];
  classes: readonly RosterCatalogClass[];
  guardians: readonly RosterCatalogGuardian[];
  students: readonly RosterCatalogStudent[];
};

export type RosterPreviewGuardian =
  | {kind: 'CREATE'; email: string}
  | {kind: 'REUSE'; id: string}
  | {kind: 'INVALID'};

export type RosterPreviewGroup = {
  classSubjectId: string;
  subjectNameEn: string;
  groupId: string | null;
  groupNameEn: string | null;
  mode: 'EXPLICIT' | 'DEFAULT' | 'UNGROUPED';
};

export type CanonicalRosterImportRow = {
  rowNumber: number;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  guardianId: string | null;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  reportLanguage: RosterLanguage;
  classId: string;
  startsOn: string;
  groups: Array<{
    classSubjectId: string;
    groupId: string | null;
  }>;
};

export type RosterImportPreviewRow = {
  rowNumber: number;
  studentName: string;
  guardianEmail: string;
  guardian: RosterPreviewGuardian;
  class: {id: string; nameEn: string} | null;
  groups: RosterPreviewGroup[];
  issues: RosterIssue[];
  canonical: CanonicalRosterImportRow | null;
};

export type RosterImportPreview = {
  issues: RosterIssue[];
  rows: RosterImportPreviewRow[];
  hasErrors: boolean;
  summary: {
    rows: number;
    guardiansToCreate: number;
    guardiansToReuse: number;
  };
};

export type RosterImportSummary = {
  rowCount: number;
  studentsCreated: number;
  guardiansCreated: number;
  guardiansReused: number;
};
