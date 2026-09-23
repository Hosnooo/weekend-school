export type AttendanceStatus='PRESENT'|'ABSENT';
export type AttendanceObservation={teacherProfileId:string;status:AttendanceStatus};
export type EffectiveAttendance={status:AttendanceStatus|null;conflict:boolean;source:'CONSENSUS'|'RESOLUTION'|'NONE'};
