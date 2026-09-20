import {z} from 'zod'; import {optionalText} from '@/lib/validation/fields';
export const performanceSchema=z.enum(['EXCELLENT','GOOD','DEVELOPING','NEEDS_SUPPORT']);
export const attendanceStatusSchema=z.enum(['PRESENT','ABSENT','LATE','EXCUSED']);
export const weeklyUpdateSchema=z.object({sessionId:z.uuid().nullable(),groupId:z.uuid(),sessionDate:z.iso.date(),progressEn:optionalText,progressAr:optionalText,defaultPerformance:performanceSchema.nullable(),attendance:z.array(z.object({studentId:z.uuid(),status:attendanceStatusSchema})),exceptions:z.array(z.object({studentId:z.uuid(),performanceOverride:performanceSchema.nullable(),commentEn:optionalText,commentAr:optionalText})),intent:z.enum(['draft','submit'])});
export type WeeklyUpdateInput=z.infer<typeof weeklyUpdateSchema>;
