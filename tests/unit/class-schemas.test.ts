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

    const parsed = classSchema.parse({
      nameEn: ' Class 5 ',
      nameAr: '',
      startsOn: '2026-09-01',
      endsOn: ''
    });
    expect(parsed).toEqual({
      nameEn: 'Class 5',
      nameAr: null,
      startsOn: '2026-09-01',
      endsOn: null
    });
  });

  it('accepts bilingual Class names', () => {
    expect(classSchema.parse({
      nameEn: 'Class 5',
      nameAr: 'الصف الخامس',
      startsOn: '2026-09-01',
      endsOn: ''
    })).toEqual({
      nameEn: 'Class 5',
      nameAr: 'الصف الخامس',
      startsOn: '2026-09-01',
      endsOn: null
    });
  });

  it('requires a Class start date and prevents an end date before it', () => {
    expect(classSchema.safeParse({
      nameEn: 'Class 5',
      nameAr: '',
      startsOn: '',
      endsOn: ''
    }).success).toBe(false);

    expect(classSchema.safeParse({
      nameEn: 'Class 5',
      nameAr: '',
      startsOn: '2026-09-01',
      endsOn: '2026-08-31'
    }).success).toBe(false);

    expect(classSchema.parse({
      nameEn: 'Class 5',
      nameAr: '',
      startsOn: '2026-09-01',
      endsOn: '2027-06-30'
    })).toEqual({
      nameEn: 'Class 5',
      nameAr: null,
      startsOn: '2026-09-01',
      endsOn: '2027-06-30'
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
