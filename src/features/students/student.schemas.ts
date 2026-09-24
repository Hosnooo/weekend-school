import {z} from 'zod';

import {databaseUuid, optionalText, requiredText} from '@/lib/validation/fields';

export const studentUpdateSchema = z.object({
  id: databaseUuid,
  firstNameEn: requiredText,
  lastNameEn: requiredText,
  firstNameAr: optionalText,
  lastNameAr: optionalText
});

export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
