import {z} from 'zod';

import {databaseUuid, normalizedEmail, requiredText} from '@/lib/validation/fields';

export const guardianSchema = z.object({
  name: requiredText,
  email: normalizedEmail,
  reportLanguage: z.enum(['en', 'ar', 'both'])
});

export const guardianUpdateSchema = guardianSchema.extend({id: databaseUuid});

export type GuardianInput = z.infer<typeof guardianSchema>;
