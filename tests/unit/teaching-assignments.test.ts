import {describe, expect, it} from 'vitest';

import {
  classifyTeachingAssignments,
  expandEffectiveTeachingContexts,
  validateTeachingAssignmentDateRange
} from '@/features/teaching-assignments/teaching-assignment.service';
import type {
  TeachingAssignment,
  TeachingClassSubject
} from '@/features/teaching-assignments/teaching-assignment.types';

const teacherA = '11111111-1111-4111-8111-111111111111';
const teacherB = '22222222-2222-4222-8222-222222222222';

const quran: TeachingClassSubject = {
  id: '31111111-1111-4111-8111-111111111111',
  classNameEn: 'Level 1',
  classNameAr: 'المستوى الأول',
  subjectNameEn: 'Quran',
  subjectNameAr: 'القرآن',
  groups: [
    {id: '41111111-1111-4111-8111-111111111111', nameEn: 'Quran A', nameAr: 'قرآن أ', isActive: true},
    {id: '41111111-1111-4111-8111-111111111112', nameEn: 'Quran B', nameAr: 'قرآن ب', isActive: true}
  ]
};

const arabic: TeachingClassSubject = {
  id: '31111111-1111-4111-8111-111111111112',
  classNameEn: 'Level 1',
  classNameAr: 'المستوى الأول',
  subjectNameEn: 'Arabic',
  subjectNameAr: 'العربية',
  groups: []
};

const islamic: TeachingClassSubject = {
  id: '31111111-1111-4111-8111-111111111113',
  classNameEn: 'Level 2',
  classNameAr: 'المستوى الثاني',
  subjectNameEn: 'Islamic Studies',
  subjectNameAr: 'الدراسات الإسلامية',
  groups: [{id: '41111111-1111-4111-8111-111111111113', nameEn: 'Islamic A', nameAr: 'إسلامي أ', isActive: true}]
};

function assignment(
  teacherId: string,
  classSubjectId: string,
  subjectGroupId: string | null,
  startsOn = '2026-09-01',
  endsOn: string | null = null
): TeachingAssignment {
  return {
    id: crypto.randomUUID(),
    teacherId,
    classSubjectId,
    subjectGroupId,
    startsOn,
    endsOn
  };
}

describe('flexible teaching assignments', () => {
  it('supports multiple Classes and Subjects for one teacher without a primary role', () => {
    const contexts = expandEffectiveTeachingContexts({
      teacherId: teacherA,
      assignments: [
        assignment(teacherA, quran.id, quran.groups[0]!.id),
        assignment(teacherA, arabic.id, null),
        assignment(teacherA, islamic.id, islamic.groups[0]!.id)
      ],
      classSubjects: [quran, arabic, islamic],
      onDate: '2026-09-23'
    });

    expect(contexts.map(({classSubjectId, subjectGroupId}) => ({classSubjectId, subjectGroupId}))).toEqual([
      {classSubjectId: quran.id, subjectGroupId: quran.groups[0]!.id},
      {classSubjectId: arabic.id, subjectGroupId: null},
      {classSubjectId: islamic.id, subjectGroupId: islamic.groups[0]!.id}
    ]);
  });

  it('allows two teachers to share the exact same Group context', () => {
    const shared = quran.groups[0]!.id;
    const assignments = [
      assignment(teacherA, quran.id, shared),
      assignment(teacherB, quran.id, shared)
    ];

    expect(expandEffectiveTeachingContexts({teacherId: teacherA, assignments, classSubjects: [quran], onDate: '2026-09-23'})).toHaveLength(1);
    expect(expandEffectiveTeachingContexts({teacherId: teacherB, assignments, classSubjects: [quran], onDate: '2026-09-23'})).toHaveLength(1);
  });

  it('expands a whole-Subject assignment to every active Group and deduplicates an exact Group assignment', () => {
    const contexts = expandEffectiveTeachingContexts({
      teacherId: teacherA,
      assignments: [
        assignment(teacherA, quran.id, null),
        assignment(teacherA, quran.id, quran.groups[0]!.id)
      ],
      classSubjects: [quran],
      onDate: '2026-09-23'
    });

    expect(contexts.map(({subjectGroupId}) => subjectGroupId)).toEqual([
      quran.groups[0]!.id,
      quran.groups[1]!.id
    ]);
  });

  it('keeps a whole-Class-Subject context when the Subject has no Groups', () => {
    const contexts = expandEffectiveTeachingContexts({
      teacherId: teacherA,
      assignments: [assignment(teacherA, arabic.id, null)],
      classSubjects: [arabic],
      onDate: '2026-09-23'
    });

    expect(contexts).toEqual([expect.objectContaining({
      classSubjectId: arabic.id,
      subjectGroupId: null,
      subjectNameEn: 'Arabic'
    })]);
  });

  it('ignores inactive and out-of-date assignment contexts', () => {
    const contexts = expandEffectiveTeachingContexts({
      teacherId: teacherA,
      assignments: [
        assignment(teacherA, quran.id, null, '2026-09-01', '2026-09-20'),
        assignment(teacherA, islamic.id, islamic.groups[0]!.id)
      ],
      classSubjects: [quran, {...islamic, isActive: false}],
      onDate: '2026-09-23'
    });

    expect(contexts).toEqual([]);
  });

  it('classifies assignments as current, upcoming, and past for a school-local date', () => {
    const assignments = [
      assignment(teacherA, quran.id, null, '2026-09-01', '2026-09-20'),
      assignment(teacherA, arabic.id, null, '2026-09-21', null),
      assignment(teacherA, islamic.id, islamic.groups[0]!.id, '2026-10-01', null)
    ];

    const result = classifyTeachingAssignments(assignments, '2026-09-24');

    expect(result.past.map(({startsOn}) => startsOn)).toEqual(['2026-09-01']);
    expect(result.current.map(({startsOn}) => startsOn)).toEqual(['2026-09-21']);
    expect(result.upcoming.map(({startsOn}) => startsOn)).toEqual(['2026-10-01']);
  });

  it('validates editable assignment date ranges before persistence', () => {
    expect(validateTeachingAssignmentDateRange('2026-09-24', null)).toEqual({
      startsOn: '2026-09-24',
      endsOn: null
    });
    expect(validateTeachingAssignmentDateRange('2026-09-24', '2026-10-31')).toEqual({
      startsOn: '2026-09-24',
      endsOn: '2026-10-31'
    });
    expect(() => validateTeachingAssignmentDateRange('2026-09-24', '2026-09-23'))
      .toThrow(/end date/i);
  });
});
