import type {AttendanceStatus,Performance,StudentException} from './weekly-update.model';
export type TeacherGroup={id:string;nameEn:string;nameAr:string|null;studentCount:number;lastUpdate:string|null};
export type RosterStudent={id:string;nameEn:string;nameAr:string|null};
export type WeeklySession={id:string;groupId:string;groupNameEn:string;groupNameAr:string|null;sessionDate:string;status:'DRAFT'|'SUBMITTED';isOwnedDraft:boolean;progressEn:string|null;progressAr:string|null;defaultPerformance:Performance|null;roster:RosterStudent[];attendance:Array<{studentId:string;status:AttendanceStatus}>;exceptions:StudentException[]};
export type HistoryItem={id:string;groupNameEn:string;groupNameAr:string|null;sessionDate:string;submittedAt:string|null};
