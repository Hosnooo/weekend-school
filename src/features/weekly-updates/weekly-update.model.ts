export type Performance='EXCELLENT'|'GOOD'|'DEVELOPING'|'NEEDS_SUPPORT';
export type AttendanceStatus='PRESENT'|'ABSENT';
export type StudentException={studentId:string;performanceOverride:Performance|null;commentEn:string|null;commentAr:string|null};

export function effectivePerformance(groupDefault:Performance|null,override:Performance|null){return override??groupDefault;}
export function markAllPresent(studentIds:string[]){return studentIds.map((studentId)=>({studentId,status:'PRESENT' as const}));}
export function toSparseExceptions(items:Array<{studentId:string;performanceOverride:Performance|null;commentEn:string|null;commentAr:string|null}>):StudentException[]{return items.flatMap((item)=>{const commentEn=item.commentEn?.trim()||null;const commentAr=item.commentAr?.trim()||null;return item.performanceOverride||commentEn||commentAr?[{...item,commentEn,commentAr}]:[];});}
export function toDatabasePayload(attendance:Array<{studentId:string;status:AttendanceStatus}>,exceptions:StudentException[]){return{attendance:attendance.map((item)=>({student_id:item.studentId,status:item.status})),exceptions:exceptions.map((item)=>({student_id:item.studentId,performance_override:item.performanceOverride,comment_en:item.commentEn,comment_ar:item.commentAr}))};}
export function todayInTimeZone(timeZone:string,now=new Date()){const parts=new Intl.DateTimeFormat('en',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const value=(type:Intl.DateTimeFormatPartTypes)=>parts.find((part)=>part.type===type)?.value;return `${value('year')}-${value('month')}-${value('day')}`;}
