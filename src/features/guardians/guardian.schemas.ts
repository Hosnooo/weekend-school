import {z} from 'zod';

import {normalizedEmail, requiredText} from '@/lib/validation/fields';

export const guardianSchema = z.object({
  name: requiredText,
  email: normalizedEmail,
  reportLanguage: z.enum(['en', 'ar', 'both'])
});

export const guardianUpdateSchema = guardianSchema.extend({id: z.uuid()});

export type GuardianInput = z.infer<typeof guardianSchema>;
