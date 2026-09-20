import {z} from 'zod';

import {optionalText, optionalUuid, requiredText} from '@/lib/validation/fields';

export const groupSchema = z.object({
  nameEn: requiredText,
  nameAr: optionalText,
  parentGroupId: optionalUuid,
  teacherProfileId: optionalUuid
});

export const groupUpdateSchema = groupSchema.extend({id: z.uuid()});

export type GroupInput = z.infer<typeof groupSchema>;
