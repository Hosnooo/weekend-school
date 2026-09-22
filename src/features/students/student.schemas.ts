import {z} from 'zod';

import {
  databaseUuid,
  normalizedEmail,
  optionalText,
  requiredText
} from '@/lib/validation/fields';

export const studentSchema = z.object({
  firstNameEn: requiredText,
  lastNameEn: requiredText,
  firstNameAr: optionalText,
  lastNameAr: optionalText,
  groupId: databaseUuid,
  guardianName: requiredText,
  guardianEmail: normalizedEmail,
  reportLanguage: z.enum(['en', 'ar', 'both'])
});

export const studentUpdateSchema = z.object({
  id: databaseUuid,
  firstNameEn: requiredText,
  lastNameEn: requiredText,
  firstNameAr: optionalText,
  lastNameAr: optionalText
});

export type StudentInput = z.infer<typeof studentSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
