import {describe, expect, it} from 'vitest';

import {
  canAdmin,
  canTeach,
  type AccountCapabilities
} from '@/lib/auth/authorization';

const adminOnly: AccountCapabilities = {isAdmin: true, teacherIds: []};
const teacherOnly: AccountCapabilities = {isAdmin: false, teacherIds: ['teacher-1']};
const dualRole: AccountCapabilities = {isAdmin: true, teacherIds: ['teacher-1']};
const noCapabilities: AccountCapabilities = {isAdmin: false, teacherIds: []};

describe('independent role authorization', () => {
  it('grants administrator access only from the administrator capability', () => {
    expect(canAdmin(adminOnly)).toBe(true);
    expect(canAdmin(teacherOnly)).toBe(false);
    expect(canAdmin(noCapabilities)).toBe(false);
  });

  it('does not let an administrator teach without an explicit Teacher link', () => {
    expect(canTeach(adminOnly)).toBe(false);
  });

  it('grants teaching access when at least one Teacher record is explicitly linked', () => {
    expect(canTeach(teacherOnly)).toBe(true);
    expect(canTeach(dualRole)).toBe(true);
  });

  it('allows administrator and teacher capabilities to coexist independently', () => {
    expect(canAdmin(dualRole)).toBe(true);
    expect(canTeach(dualRole)).toBe(true);
  });
});
