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

const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

const optionalIsoDate = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  isoDate.nullable()
);

export const classSchema = bilingualNameSchema
  .extend({
    startsOn: isoDate,
    endsOn: optionalIsoDate
  })
  .superRefine((value, context) => {
    if (value.endsOn !== null && value.endsOn < value.startsOn) {
      context.addIssue({
        code: 'custom',
        path: ['endsOn'],
        message: 'Class end date cannot be before start date'
      });
    }
  });

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
