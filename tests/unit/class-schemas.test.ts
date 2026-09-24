import {describe, expect, it} from 'vitest';

import {
  classSchema,
  classSubjectSchema,
  subjectGroupSchema
} from '@/features/classes/class.schemas';

const subjectId = '82000000-0000-0000-0000-000000000001';
const classSubjectId = '83000000-0000-0000-0000-000000000001';

describe('Class administration schemas', () => {
  it('requires an English Class display name and normalizes an empty Arabic name', () => {
    expect(classSchema.safeParse({nameEn: '   ', nameAr: ''}).success).toBe(false);

    const parsed = classSchema.parse({nameEn: ' Class 5 ', nameAr: ''});
    expect(parsed).toEqual({nameEn: 'Class 5', nameAr: null});
  });

  it('accepts bilingual Class names', () => {
    expect(classSchema.parse({nameEn: 'Class 5', nameAr: 'الصف الخامس'})).toEqual({
      nameEn: 'Class 5',
      nameAr: 'الصف الخامس'
    });
  });

  it('requires a selected Subject for a Class Subject offering', () => {
    expect(classSubjectSchema.safeParse({subjectId: ''}).success).toBe(false);
    expect(classSubjectSchema.parse({subjectId})).toEqual({subjectId});
  });

  it('requires an English Group name and a valid Class Subject', () => {
    expect(
      subjectGroupSchema.safeParse({
        classSubjectId,
        nameEn: '',
        nameAr: ''
      }).success
    ).toBe(false);

    expect(
      subjectGroupSchema.parse({
        classSubjectId,
        nameEn: ' Group A ',
        nameAr: ''
      })
    ).toEqual({classSubjectId, nameEn: 'Group A', nameAr: null});
  });
});
