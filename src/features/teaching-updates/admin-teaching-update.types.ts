export type AdminTeachingUpdateStatus =
  | 'OPEN'
  | 'SUBMITTED'
  | 'DISMISSED';

export type AdminTeachingUpdateSource =
  | 'TEACHER'
  | 'ADMIN_REQUEST';

export type AdminTeachingUpdateCoverageKind =
  | 'RANGE'
  | 'DATES';

export type AdminTeachingUpdate = {
  id: string;
  teacherId: string | null;
  teacherName: string | null;
  classSubjectId: string;
  subjectGroupId: string | null;
  classNameEn: string;
  classNameAr: string | null;
  subjectNameEn: string;
  subjectNameAr: string | null;
  groupNameEn: string | null;
  groupNameAr: string | null;
  requestSetId: string | null;
  source: AdminTeachingUpdateSource;
  coverageKind: AdminTeachingUpdateCoverageKind;
  periodStart: string;
  periodEnd: string;
  exactDates: string[];
  status: AdminTeachingUpdateStatus;
  progressEn: string | null;
  progressAr: string | null;
  createdByProfileId: string | null;
  createdByName: string | null;
  requestedByProfileId: string | null;
  requestedByName: string | null;
  adminNote: string | null;
  dismissedAt: string | null;
  dismissedByProfileId: string | null;
  dismissedByName: string | null;
  dismissalReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminTeachingUpdateRequestSet = {
  id: string;
  classSubjectId: string;
  classNameEn: string;
  classNameAr: string | null;
  subjectNameEn: string;
  subjectNameAr: string | null;
  coverageKind: AdminTeachingUpdateCoverageKind;
  periodStart: string;
  periodEnd: string;
  requestedByProfileId: string;
  requestedByName: string | null;
  adminNote: string | null;
  createdAt: string;
  totalCount: number;
  submittedCount: number;
  openCount: number;
  dismissedCount: number;
};

export type AdminTeachingUpdateContext = {
  classId: string;
  classNameEn: string;
  classNameAr: string | null;
  classSubjectId: string;
  subjectNameEn: string;
  subjectNameAr: string | null;
  activeGroupCount: number;
};
