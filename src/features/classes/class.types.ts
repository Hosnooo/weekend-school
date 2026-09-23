export type SubjectGroupSummary={id:string;nameEn:string;nameAr:string|null;isDefault:boolean};
export type ClassSubjectSummary={id:string;subject:{id:string;nameEn:string;nameAr:string|null};groups:SubjectGroupSummary[];teacherCount:number};
export type ClassSummary={id:string;nameEn:string;nameAr:string|null;activeStudentCount:number;subjects:ClassSubjectSummary[]};
