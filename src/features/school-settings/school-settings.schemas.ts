import {z} from 'zod';

import {requiredText} from '@/lib/validation/fields';

const timezone = z.string().trim().min(1).refine((value) => {
  try {
    new Intl.DateTimeFormat('en', {timeZone: value});
    return true;
  } catch {
    return false;
  }
});

export const schoolSettingsSchema = z.object({
  nameEn: requiredText,
  nameAr: requiredText,
  timezone,
  defaultLanguage: z.enum(['en', 'ar'])
});

export type SchoolSettingsInput = z.infer<typeof schoolSettingsSchema>;
