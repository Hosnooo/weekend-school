import {z} from 'zod';
const optionalName=z.string().trim().min(1).max(120).nullable().optional().transform(value=>value||null);
export const classSchema=z.object({nameEn:z.string().trim().min(1).max(120),nameAr:optionalName});
export const subjectSchema=classSchema;
export const classSubjectSchema=z.object({classId:z.uuid(),subjectId:z.uuid()});
export const subjectGroupSchema=z.object({classSubjectId:z.uuid(),nameEn:z.string().trim().min(1).max(120),nameAr:optionalName});
