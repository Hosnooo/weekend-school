import {z} from 'zod';

export const languagePreferenceSchema = z.object({
  locale: z.enum(['en', 'ar']),
  pathname: z.string().regex(/^\/(?!\/)/)
});
