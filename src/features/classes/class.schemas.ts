import {z} from 'zod';

import {
  databaseUuid,
  optionalText,
  requiredText
} from '@/lib/validation/fields';

const bilingualNameSchema = z.object({
  nameEn: requiredText,
  nameAr: optionalText
});

export const classSchema = bilingualNameSchema;
export const subjectSchema = bilingualNameSchema;

export const classSubjectSchema = z.object({
  subjectId: databaseUuid
});

export const subjectGroupSchema = z.object({
  classSubjectId: databaseUuid,
  nameEn: requiredText,
  nameAr: optionalText
});

export const defaultGroupSchema = z.object({
  classSubjectId: databaseUuid,
  subjectGroupId: databaseUuid
});

export type ClassInput = z.infer<typeof classSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type ClassSubjectInput = z.infer<typeof classSubjectSchema>;
export type SubjectGroupInput = z.infer<typeof subjectGroupSchema>;
export type DefaultGroupInput = z.infer<typeof defaultGroupSchema>;
