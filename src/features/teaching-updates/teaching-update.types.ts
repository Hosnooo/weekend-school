import type {
  AttendanceStatus,
  Performance,
  StudentException
} from '@/features/weekly-updates/weekly-update.model';

export type TeachingUpdateCoverageKind = 'RANGE' | 'DATES';
export type TeachingUpdateStatus =
  | 'OPEN'
  | 'SUBMITTED'
  | 'DISMISSED';

export type TeachingUpdateStorageStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'DISMISSED';

export type TeachingUpdateRosterStudent = {
  id: string;
  nameEn: string;
  nameAr: string | null;
};

export type TeachingUpdateContext = {
  classSubjectId: string;
  subjectGroupId: string | null;
  classNameEn: string;
  classNameAr: string | null;
  subjectNameEn: string;
  subjectNameAr: string | null;
  groupNameEn: string | null;
  groupNameAr: string | null;
};

export type TeachingUpdate = TeachingUpdateContext & {
  id: string;
  teacherId: string | null;
  coverageKind: TeachingUpdateCoverageKind;
  periodStart: string;
  periodEnd: string;
  dates: string[];
  status: TeachingUpdateStatus;
  version: number;
  requestSetId: string | null;
  requestedByProfileId: string | null;
  adminNote: string | null;
  dismissalReason: string | null;
  submittedAt: string | null;
  progressEn: string | null;
  progressAr: string | null;
  defaultPerformance: Performance | null;
  roster: TeachingUpdateRosterStudent[];
  attendance: Array<{
    studentId: string;
    status: AttendanceStatus;
  }>;
  exceptions: StudentException[];
};

export type TeachingUpdateOverlap = {
  id: string;
  subjectGroupId: string | null;
  coverageKind: TeachingUpdateCoverageKind;
  periodStart: string;
  periodEnd: string;
  status: TeachingUpdateStatus;
};

export type TeachingUpdateActionState = {
  status: 'idle' | 'saved' | 'error';
  error:
    | 'validation'
    | 'save'
    | 'conflict'
    | null;
  submissionId: string | null;
  overlaps: TeachingUpdateOverlap[];
};

export const initialTeachingUpdateActionState:
TeachingUpdateActionState = {
  status: 'idle',
  error: null,
  submissionId: null,
  overlaps: []
};
