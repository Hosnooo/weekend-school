import {z} from 'zod';

import {
  databaseUuid,
  normalizedEmail,
  optionalText,
  optionalUuid,
  requiredText
} from '@/lib/validation/fields';

const subjectSelectionSchema = z.object({
  classSubjectId: databaseUuid,
  included: z.boolean(),
  groupId: optionalUuid
});

const optionalNormalizedEmail = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  normalizedEmail.nullable()
);

export const guardianCreationModeSchema = z.enum([
  'none',
  'existing',
  'new'
]);

export const createStudentEnrollmentSchema = z.object({
  firstNameEn: requiredText,
  lastNameEn: requiredText,
  firstNameAr: optionalText,
  lastNameAr: optionalText,
  guardianMode: guardianCreationModeSchema,
  guardianId: optionalUuid,
  guardianName: optionalText,
  guardianEmail: optionalNormalizedEmail,
  guardianPhone: optionalText,
  reportLanguage: z.enum(['en', 'ar', 'both']),
  classId: databaseUuid,
  startsOn: z.iso.date(),
  subjects: z.array(subjectSelectionSchema)
}).superRefine((value, ctx) => {
  const suppliedGuardianDetails = [
    value.guardianName,
    value.guardianEmail,
    value.guardianPhone
  ].filter((item) => item !== null).length;

  if (value.guardianMode === 'none') {
    if (value.guardianId !== null || suppliedGuardianDetails !== 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'No Guardian identity may be supplied',
        path: ['guardianMode']
      });
    }
    return;
  }

  if (value.guardianMode === 'existing') {
    if (value.guardianId === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Existing Guardian ID is required',
        path: ['guardianId']
      });
    }

    if (suppliedGuardianDetails !== 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Existing Guardian must be selected by ID',
        path: ['guardianId']
      });
    }
    return;
  }

  if (value.guardianId !== null || suppliedGuardianDetails !== 3) {
    ctx.addIssue({
      code: 'custom',
      message: 'Complete new Guardian details are required',
      path: ['guardianName']
    });
  }
});

export const changeStudentClassSchema = z.object({
  studentId: databaseUuid,
  targetClassId: databaseUuid,
  startsOn: z.iso.date()
});

export const updateStudentEnrollmentStartSchema = z.object({
  studentId: databaseUuid,
  startsOn: z.iso.date()
});

export const setSubjectExcludedSchema = z.object({
  studentId: databaseUuid,
  classSubjectId: databaseUuid,
  excluded: z.boolean(),
  effectiveOn: z.iso.date()
});

export const moveStudentSubjectGroupSchema = z.object({
  studentId: databaseUuid,
  classSubjectId: databaseUuid,
  targetGroupId: databaseUuid,
  startsOn: z.iso.date()
});

export type CreateStudentEnrollmentInput = z.infer<typeof createStudentEnrollmentSchema>;
export type ChangeStudentClassInput = z.infer<typeof changeStudentClassSchema>;
export type UpdateStudentEnrollmentStartInput = z.infer<typeof updateStudentEnrollmentStartSchema>;
export type SetSubjectExcludedInput = z.infer<typeof setSubjectExcludedSchema>;
export type MoveStudentSubjectGroupInput = z.infer<typeof moveStudentSubjectGroupSchema>;
