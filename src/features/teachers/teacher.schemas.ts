import {z} from 'zod';

import {databaseUuid, normalizedEmail, requiredText} from '@/lib/validation/fields';

export const teacherSchema = z.object({
  displayName: requiredText,
  email: normalizedEmail,
  preferredLanguage: z.enum(['en', 'ar'])
});

export const teacherUpdateSchema = z.object({
  id: databaseUuid,
  displayName: requiredText,
  preferredLanguage: z.enum(['en', 'ar'])
});

export type TeacherInput = z.infer<typeof teacherSchema>;
