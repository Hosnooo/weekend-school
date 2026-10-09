import {z} from 'zod';

export const ownNameSchema = z.string().trim().min(2).max(100);
export const ownEmailSchema = z.email().trim().max(254);
export const ownPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/[0-9]/),
  confirmPassword: z.string().min(1)
});

export type AccountResult = {status: 'success' | 'sent'} | {
  status: 'error';
  reason: 'nameInvalid' | 'nameUnavailable' | 'sameEmail' | 'invalidEmail' |
    'emailUnavailable' | 'incorrectPassword' | 'mismatch' | 'samePassword' |
    'invalidPassword' | 'passwordUnavailable' | 'signInRequired';
};

export function validateOwnPassword(values: unknown):
  | {success: true; values: z.infer<typeof ownPasswordSchema>}
  | {success: false; reason: 'invalidPassword' | 'mismatch' | 'samePassword'} {
  const result = ownPasswordSchema.safeParse(values);
  if (!result.success) return {success: false, reason: 'invalidPassword'};
  if (result.data.newPassword !== result.data.confirmPassword) {
    return {success: false, reason: 'mismatch'};
  }
  if (result.data.currentPassword === result.data.newPassword) {
    return {success: false, reason: 'samePassword'};
  }
  return {success: true, values: result.data};
}
