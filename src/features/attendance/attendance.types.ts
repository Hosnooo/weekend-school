export type OfficialAttendanceStatus = 'PRESENT' | 'ABSENT';
export type AttendanceContext={classSubjectId:string;subjectGroupId:string|null;weekStart:string;studentId:string};
export type EffectiveAttendance={status:OfficialAttendanceStatus|null;conflict:boolean;resolved:boolean;observationCount:number};
export type AttendanceObservation={teacherId:string;teacherName:string;status:OfficialAttendanceStatus};
export type AttendanceConflict=AttendanceContext&{studentNameEn:string;studentNameAr:string|null;classNameEn:string;classNameAr:string|null;subjectNameEn:string;subjectNameAr:string|null;groupNameEn:string|null;groupNameAr:string|null;observations:AttendanceObservation[];resolution:OfficialAttendanceStatus|null};
