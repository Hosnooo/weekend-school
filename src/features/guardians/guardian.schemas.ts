import {z} from 'zod';

import {databaseUuid, normalizedEmail, requiredText} from '@/lib/validation/fields';

export const guardianSchema = z.object({
  name: requiredText,
  email: normalizedEmail,
  phone: requiredText,
  reportLanguage: z.enum(['en', 'ar', 'both'])
});

export const guardianUpdateSchema = guardianSchema.extend({id: databaseUuid});

export const studentGuardianLinkSchema = guardianSchema.extend({
  studentId: databaseUuid,
  isPrimary: z.boolean(),
  receivesReports: z.boolean()
});

export const studentGuardianUpdateSchema = studentGuardianLinkSchema.extend({
  guardianId: databaseUuid
});

export const studentGuardianUnlinkSchema = z.object({
  studentId: databaseUuid,
  guardianId: databaseUuid
});

export type GuardianInput = z.infer<typeof guardianSchema>;
export type StudentGuardianLinkInput = z.infer<typeof studentGuardianLinkSchema>;
export type StudentGuardianUpdateInput = z.infer<typeof studentGuardianUpdateSchema>;
