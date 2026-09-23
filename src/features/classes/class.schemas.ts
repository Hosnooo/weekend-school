import {z} from 'zod';

import {
  databaseUuid,
  optionalText,
  requiredText
} from '@/lib/validation/fields';

export const classSchema = z.object({
  nameEn: requiredText,
  nameAr: optionalText
});

export const classSubjectSchema = z.object({
  subjectId: databaseUuid
});

export const subjectGroupSchema = z.object({
  classSubjectId: databaseUuid,
  nameEn: requiredText,
  nameAr: optionalText
});

export type ClassInput = z.infer<typeof classSchema>;
export type ClassSubjectInput = z.infer<typeof classSubjectSchema>;
export type SubjectGroupInput = z.infer<typeof subjectGroupSchema>;
