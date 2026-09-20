import {z} from 'zod';

import {normalizedEmail, requiredText} from '@/lib/validation/fields';

export const teacherSchema = z.object({
  displayName: requiredText,
  email: normalizedEmail,
  preferredLanguage: z.enum(['en', 'ar']),
  assignedGroupIds: z.array(z.uuid()).transform((ids) => [...new Set(ids)])
});

export const teacherUpdateSchema = z.object({
  id: z.uuid(),
  displayName: requiredText,
  preferredLanguage: z.enum(['en', 'ar']),
  assignedGroupIds: z.array(z.uuid()).transform((ids) => [...new Set(ids)])
});

export type TeacherInput = z.infer<typeof teacherSchema>;
