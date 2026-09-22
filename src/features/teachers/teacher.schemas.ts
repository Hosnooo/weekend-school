import {z} from 'zod';

import {databaseUuid, normalizedEmail, requiredText} from '@/lib/validation/fields';

export const teacherSchema = z.object({
  displayName: requiredText,
  email: normalizedEmail,
  preferredLanguage: z.enum(['en', 'ar']),
  assignedGroupIds: z.array(databaseUuid).transform((ids) => [...new Set(ids)])
});

export const teacherUpdateSchema = z.object({
  id: databaseUuid,
  displayName: requiredText,
  preferredLanguage: z.enum(['en', 'ar']),
  assignedGroupIds: z.array(databaseUuid).transform((ids) => [...new Set(ids)])
});

export type TeacherInput = z.infer<typeof teacherSchema>;
