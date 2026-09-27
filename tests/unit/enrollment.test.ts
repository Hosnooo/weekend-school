import {describe, expect, it} from 'vitest';

import {
  changeStudentClassSchema,
  createStudentEnrollmentSchema,
  moveStudentSubjectGroupSchema,
  setSubjectExcludedSchema
} from '@/features/enrollment/enrollment.schemas';
import {
  deriveSubjectParticipation,
  moveSubjectGroupMembership,
  planClassChange
} from '@/features/enrollment/enrollment.service';

const classId = '11111111-1111-4111-8111-111111111111';
const classSubjectId = '22222222-2222-4222-8222-222222222222';
const groupId = '33333333-3333-4333-8333-333333333333';
const studentId = '44444444-4444-4444-8444-444444444444';

const quran = {
  id: 'subject-quran',
  nameEn: 'Quran',
  nameAr: 'القرآن',
  isActive: true,
  defaultGroupId: 'quran-a',
  groups: [
    {id: 'quran-a', nameEn: 'Quran A', nameAr: null, isActive: true},
    {id: 'quran-b', nameEn: 'Quran B', nameAr: null, isActive: true}
  ]
};

const arabic = {
  id: 'subject-arabic',
  nameEn: 'Arabic',
  nameAr: 'العربية',
  isActive: true,
  defaultGroupId: null,
  groups: []
};

const islamic = {
  id: 'subject-islamic',
  nameEn: 'Islamic Studies',
  nameAr: 'الدراسات الإسلامية',
  isActive: true,
  defaultGroupId: null,
  groups: [{id: 'islamic-a', nameEn: 'Islamic A', nameAr: null, isActive: true}]
};

describe('student enrollment redesign', () => {
  it('inherits active class subjects unless excluded', () => {
    const rows = deriveSubjectParticipation({
      classSubjects: [quran, arabic, islamic],
      exclusions: [{classSubjectId: islamic.id, startsOn: '2026-09-01', endsOn: null}],
      memberships: [],
      onDate: '2026-09-23'
    });

    expect(rows.map(({classSubjectId, included}) => ({classSubjectId, included}))).toEqual([
      {classSubjectId: quran.id, included: true},
      {classSubjectId: arabic.id, included: true},
      {classSubjectId: islamic.id, included: false}
    ]);
  });

  it('uses the default group only for new or unassigned students', () => {
    const [row] = deriveSubjectParticipation({
      classSubjects: [quran],
      exclusions: [],
      memberships: [],
      onDate: '2026-09-23'
    });

    expect(row).toMatchObject({
      classSubjectId: quran.id,
      included: true,
      subjectGroupId: 'quran-a',
      assignmentNeeded: false
    });
  });

  it('does not move existing students when default group changes', () => {
    const [row] = deriveSubjectParticipation({
      classSubjects: [{...quran, defaultGroupId: 'quran-b'}],
      exclusions: [],
      memberships: [
        {
          classSubjectId: quran.id,
          subjectGroupId: 'quran-a',
          startsOn: '2026-09-01',
          endsOn: null
        }
      ],
      onDate: '2026-09-23'
    });

    expect(row.subjectGroupId).toBe('quran-a');
  });

  it('moves a student only inside one class subject and preserves old membership', () => {
    const result = moveSubjectGroupMembership(
      [
        {classSubjectId: quran.id, subjectGroupId: 'quran-a', startsOn: '2026-09-01', endsOn: null},
        {classSubjectId: 'subject-other', subjectGroupId: 'other-a', startsOn: '2026-09-01', endsOn: null}
      ],
      {
        classSubjectId: quran.id,
        subjectGroupId: 'quran-b',
        startsOn: '2026-09-20'
      }
    );

    expect(result).toEqual([
      {classSubjectId: quran.id, subjectGroupId: 'quran-a', startsOn: '2026-09-01', endsOn: '2026-09-19'},
      {classSubjectId: 'subject-other', subjectGroupId: 'other-a', startsOn: '2026-09-01', endsOn: null},
      {classSubjectId: quran.id, subjectGroupId: 'quran-b', startsOn: '2026-09-20', endsOn: null}
    ]);
  });

  it('class change ends old enrollment and initializes new subject defaults', () => {
    const plan = planClassChange({
      currentEnrollment: {classId: 'class-old', startsOn: '2026-09-01', endsOn: null},
      currentMemberships: [
        {classSubjectId: 'old-subject', subjectGroupId: 'old-a', startsOn: '2026-09-01', endsOn: null}
      ],
      targetClassId: 'class-new',
      targetClassSubjects: [quran, arabic, islamic],
      excludedClassSubjectIds: [islamic.id],
      startsOn: '2026-10-01'
    });

    expect(plan.endedEnrollment.endsOn).toBe('2026-09-30');
    expect(plan.endedMemberships[0]?.endsOn).toBe('2026-09-30');
    expect(plan.newEnrollment).toEqual({classId: 'class-new', startsOn: '2026-10-01', endsOn: null});
    expect(plan.newMemberships).toEqual([
      {classSubjectId: quran.id, subjectGroupId: 'quran-a', startsOn: '2026-10-01', endsOn: null}
    ]);
  });

  it('validates and normalizes atomic student enrollment creation input', () => {
    expect(createStudentEnrollmentSchema.parse({
      firstNameEn: '  Sara ',
      lastNameEn: ' Mohammed ',
      firstNameAr: '',
      lastNameAr: ' ',
      guardianMode: 'new',
      guardianId: '',
      guardianName: ' Amina Mohammed ',
      guardianEmail: ' Parent@Example.COM ',
      guardianPhone: ' +1 780 555 0100 ',
      reportLanguage: 'both',
      classId,
      startsOn: '2026-09-23',
      subjects: [
        {classSubjectId, included: true, groupId},
        {classSubjectId: '55555555-5555-4555-8555-555555555555', included: false, groupId: ''}
      ]
    })).toEqual({
      firstNameEn: 'Sara',
      lastNameEn: 'Mohammed',
      firstNameAr: null,
      lastNameAr: null,
      guardianMode: 'new',
      guardianId: null,
      guardianName: 'Amina Mohammed',
      guardianEmail: 'parent@example.com',
      guardianPhone: '+1 780 555 0100',
      reportLanguage: 'both',
      classId,
      startsOn: '2026-09-23',
      subjects: [
        {classSubjectId, included: true, groupId},
        {classSubjectId: '55555555-5555-4555-8555-555555555555', included: false, groupId: null}
      ]
    });
  });

  it('validates Class, Subject inclusion, and per-Subject Group mutations', () => {
    expect(changeStudentClassSchema.safeParse({studentId, targetClassId: classId, startsOn: '2026-10-01'}).success).toBe(true);
    expect(setSubjectExcludedSchema.safeParse({studentId, classSubjectId, excluded: true, effectiveOn: '2026-09-23'}).success).toBe(true);
    expect(moveStudentSubjectGroupSchema.safeParse({studentId, classSubjectId, targetGroupId: groupId, startsOn: '2026-09-23'}).success).toBe(true);
    expect(moveStudentSubjectGroupSchema.safeParse({studentId, classSubjectId, targetGroupId: '', startsOn: '2026-09-23'}).success).toBe(false);
  });
});
