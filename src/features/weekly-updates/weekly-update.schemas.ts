import {z} from 'zod'; import {databaseUuid,optionalText,optionalUuid} from '@/lib/validation/fields';
export const performanceSchema=z.enum(['EXCELLENT','GOOD','DEVELOPING','NEEDS_SUPPORT']);
export const attendanceStatusSchema=z.enum(['PRESENT','ABSENT']);
export const weeklyUpdateSchema=z.object({submissionId:optionalUuid,classSubjectId:databaseUuid,subjectGroupId:optionalUuid,weekStart:z.iso.date(),progressEn:optionalText,progressAr:optionalText,defaultPerformance:performanceSchema.nullable(),attendance:z.array(z.object({studentId:databaseUuid,status:attendanceStatusSchema})),exceptions:z.array(z.object({studentId:databaseUuid,performanceOverride:performanceSchema.nullable(),commentEn:optionalText,commentAr:optionalText})),intent:z.enum(['draft','submit'])});
export type WeeklyUpdateInput=z.infer<typeof weeklyUpdateSchema>;
