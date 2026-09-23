import {z} from 'zod';
export const enrollmentSchema=z.object({studentId:z.uuid(),classId:z.uuid(),startsOn:z.iso.date()});
export const subjectExclusionSchema=z.object({studentId:z.uuid(),classSubjectId:z.uuid(),excluded:z.boolean(),effectiveOn:z.iso.date()});
export const subjectGroupMoveSchema=z.object({studentId:z.uuid(),classSubjectId:z.uuid(),subjectGroupId:z.uuid(),effectiveOn:z.iso.date()});
