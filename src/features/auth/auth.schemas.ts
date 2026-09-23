import {z} from 'zod';
import {normalizedEmail} from '@/lib/validation/fields';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1)
});

export const passwordRecoverySchema = z.object({email: normalizedEmail});

export type LoginInput = z.infer<typeof loginSchema>;
