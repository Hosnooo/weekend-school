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

export const createStudentEnrollmentSchema = z.object({
  firstNameEn: requiredText,
  lastNameEn: requiredText,
  firstNameAr: optionalText,
  lastNameAr: optionalText,
  guardianName: requiredText,
  guardianEmail: normalizedEmail,
  reportLanguage: z.enum(['en', 'ar', 'both']),
  classId: databaseUuid,
  startsOn: z.iso.date(),
  subjects: z.array(subjectSelectionSchema)
});

export const changeStudentClassSchema = z.object({
  studentId: databaseUuid,
  targetClassId: databaseUuid,
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
export type SetSubjectExcludedInput = z.infer<typeof setSubjectExcludedSchema>;
export type MoveStudentSubjectGroupInput = z.infer<typeof moveStudentSubjectGroupSchema>;
