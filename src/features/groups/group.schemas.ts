import {z} from 'zod';

import {databaseUuid, optionalText, optionalUuid, requiredText} from '@/lib/validation/fields';

export const groupSchema = z.object({
  nameEn: requiredText,
  nameAr: optionalText,
  parentGroupId: optionalUuid,
  teacherProfileId: optionalUuid
});

export const groupUpdateSchema = groupSchema.extend({id: databaseUuid});

export type GroupInput = z.infer<typeof groupSchema>;
