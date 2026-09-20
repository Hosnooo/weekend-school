import {z} from 'zod';

import {
  normalizedEmail,
  optionalText,
  requiredText
} from '@/lib/validation/fields';

export const studentSchema = z.object({
  firstNameEn: requiredText,
  lastNameEn: requiredText,
  firstNameAr: optionalText,
  lastNameAr: optionalText,
  groupId: z.uuid(),
  guardianName: requiredText,
  guardianEmail: normalizedEmail,
  reportLanguage: z.enum(['en', 'ar', 'both'])
});

export const studentUpdateSchema = z.object({
  id: z.uuid(),
  firstNameEn: requiredText,
  lastNameEn: requiredText,
  firstNameAr: optionalText,
  lastNameAr: optionalText
});

export type StudentInput = z.infer<typeof studentSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
