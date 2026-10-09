import {describe, expect, it} from 'vitest';

import {ownNameSchema, ownEmailSchema, validateOwnPassword} from '@/features/profiles/account.schema';

describe('self-service account validation', () => {
  it('normalizes display name without modifying unrelated records', () => {
    expect(ownNameSchema.parse('  Amina Salem  ')).toBe('Amina Salem');
    expect(ownNameSchema.safeParse(' ').success).toBe(false);
    expect(ownNameSchema.safeParse('x'.repeat(101)).success).toBe(false);
  });

  it('requires a valid new login email', () => {
    expect(ownEmailSchema.parse('  new@example.com  ')).toBe('new@example.com');
    expect(ownEmailSchema.safeParse('bad address').success).toBe(false);
  });

  it('requires current password, good new password, and matching confirmation', () => {
    expect(validateOwnPassword({
      currentPassword: 'OldPass123', newPassword: 'NewPass123', confirmPassword: 'NewPass123'
    }).success).toBe(true);
    expect(validateOwnPassword({
      currentPassword: 'OldPass123', newPassword: 'NewPass123', confirmPassword: 'Different123'
    })).toEqual({success: false, reason: 'mismatch'});
    expect(validateOwnPassword({
      currentPassword: 'OldPass123', newPassword: 'OldPass123', confirmPassword: 'OldPass123'
    })).toEqual({success: false, reason: 'samePassword'});
    expect(validateOwnPassword({
      currentPassword: '', newPassword: 'weak', confirmPassword: 'weak'
    })).toEqual({success: false, reason: 'invalidPassword'});
  });
});
