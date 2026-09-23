import {describe, expect, it} from 'vitest';

import {groupSchema, groupUpdateSchema} from '@/features/groups/group.schemas';
import {guardianSchema} from '@/features/guardians/guardian.schemas';
import {membershipSchema} from '@/features/groups/membership.schemas';
import {studentUpdateSchema} from '@/features/students/student.schemas';
import {teacherSchema, teacherUpdateSchema} from '@/features/teachers/teacher.schemas';

const groupId = '11111111-1111-4111-8111-111111111111';
const studentId = '22222222-2222-4222-8222-222222222222';

describe('student administration validation', () => {
  it('normalizes student identity fields while allowing omitted Arabic names', () => {
    expect(
      studentUpdateSchema.parse({
        id: studentId,
        firstNameEn: '  Sara ',
        lastNameEn: ' Mohammed ',
        firstNameAr: ' ',
        lastNameAr: ''
      })
    ).toEqual({
      id: studentId,
      firstNameEn: 'Sara',
      lastNameEn: 'Mohammed',
      firstNameAr: null,
      lastNameAr: null
    });
  });
});

describe('guardian administration validation', () => {
  it('rejects malformed email addresses', () => {
    expect(
      guardianSchema.safeParse({name: 'Parent', email: 'not-email', reportLanguage: 'en'})
        .success
    ).toBe(false);
  });
});

describe('group administration validation', () => {
  it('requires a boolean confirmation choice on group edits', () => {
    const input = {id: groupId, nameEn: 'Level 2', nameAr: '', parentGroupId: '', teacherProfileId: ''};
    expect(groupUpdateSchema.parse({...input, allowReassignment: false}).allowReassignment).toBe(false);
    expect(groupUpdateSchema.safeParse({...input, allowReassignment: 'true'}).success).toBe(false);
  });
  it('normalizes optional relationships to null', () => {
    expect(
      groupSchema.parse({
        nameEn: ' Level 2 ',
        nameAr: '',
        parentGroupId: '',
        teacherProfileId: ''
      })
    ).toEqual({
      nameEn: 'Level 2',
      nameAr: null,
      parentGroupId: null,
      teacherProfileId: null
    });
  });
});

describe('teacher administration validation', () => {
  it('deduplicates assigned groups and normalizes the invitation email', () => {
    expect(
      teacherSchema.parse({
        displayName: ' Fatima Ali ',
        email: ' TEACHER@example.com ',
        preferredLanguage: 'ar',
        assignedGroupIds: [groupId, groupId]
      })
    ).toEqual({
      displayName: 'Fatima Ali',
      email: 'teacher@example.com',
      preferredLanguage: 'ar',
      assignedGroupIds: [groupId]
    });
  });

  it('requires explicit confirmation before an occupied group can be reassigned', () => {
    const input = {
      id: '33333333-3333-4333-8333-333333333333',
      displayName: 'Fatima Ali',
      preferredLanguage: 'en',
      assignedGroupIds: [groupId]
    };
    expect(teacherUpdateSchema.parse({...input, allowReassignment: false}).allowReassignment).toBe(false);
    expect(teacherUpdateSchema.parse({...input, allowReassignment: true}).allowReassignment).toBe(true);
    expect(teacherUpdateSchema.safeParse({...input, allowReassignment: 'true'}).success).toBe(false);
  });

});

describe('membership administration validation', () => {
  it('rejects an end date before the start date', () => {
    expect(
      membershipSchema.safeParse({
        groupId,
        studentId,
        startsOn: '2026-09-20',
        endsOn: '2026-09-19'
      }).success
    ).toBe(false);
  });
});
