import type {AttendanceStatus,Performance,StudentException} from './weekly-update.model';

export type TeachingContext={
  classSubjectId:string;
  subjectGroupId:string|null;
  classNameEn:string;
  classNameAr:string|null;
  subjectNameEn:string;
  subjectNameAr:string|null;
  groupNameEn:string|null;
  groupNameAr:string|null;
};
export type TeachingCard=TeachingContext&{studentCount:number;weekStart:string;submissionId:string|null;status:'MISSING'|'DRAFT'|'SUBMITTED'};
export type RosterStudent={id:string;nameEn:string;nameAr:string|null};
export type WeeklySubmission=TeachingContext&{id:string;weekStart:string;status:'DRAFT'|'SUBMITTED';progressEn:string|null;progressAr:string|null;defaultPerformance:Performance|null;roster:RosterStudent[];attendance:Array<{studentId:string;status:AttendanceStatus}>;exceptions:StudentException[]};
export type HistoryItem=TeachingContext&{id:string;weekStart:string;submittedAt:string|null};
