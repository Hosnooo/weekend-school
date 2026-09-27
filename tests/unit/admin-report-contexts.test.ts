import {describe, expect, it} from 'vitest';

import {
  deriveAdminReportContexts,
  deriveReportContextStatus
} from '@/features/reports/admin-report-contexts';

const classes = [
  {
    id: 'class-1',
    nameEn: 'Level 1',
    nameAr: 'المستوى ١',
    isActive: true,
    subjects: [
      {
        id: 'subject-1',
        nameEn: 'Quran',
        nameAr: 'القرآن',
        isActive: true,
        defaultGroupId: null,
        groups: []
      },
      {
        id: 'subject-2',
        nameEn: 'Arabic',
        nameAr: 'العربية',
        isActive: true,
        defaultGroupId: 'group-1',
        groups: [
          {
            id: 'group-1',
            nameEn: 'Group A',
            nameAr: 'المجموعة أ',
            isActive: true
          },
          {
            id: 'group-2',
            nameEn: 'Group B',
            nameAr: 'المجموعة ب',
            isActive: true
          }
        ]
      }
    ]
  }
];

describe('admin report contexts', () => {
  it('maps workflow state to administrator-facing status', () => {
    expect(
      deriveReportContextStatus({
        submissionCount: 0,
        batch: null,
        reports: []
      })
    ).toBe('WAITING');

    expect(
      deriveReportContextStatus({
        submissionCount: 2,
        batch: null,
        reports: []
      })
    ).toBe('READY_FOR_REVIEW');

    expect(
      deriveReportContextStatus({
        submissionCount: 2,
        batch: {
          status: 'DRAFT'
        },
        reports: []
      })
    ).toBe('READY_FOR_REVIEW');

    expect(
      deriveReportContextStatus({
        submissionCount: 2,
        batch: {
          status: 'FINALIZED'
        },
        reports: [{status: 'READY'}]
      })
    ).toBe('READY_TO_SEND');

    expect(
      deriveReportContextStatus({
        submissionCount: 2,
        batch: {
          status: 'FINALIZED'
        },
        reports: [
          {status: 'SENT'},
          {status: 'SENT'}
        ]
      })
    ).toBe('SENT');

    expect(
      deriveReportContextStatus({
        submissionCount: 2,
        batch: {
          status: 'FINALIZED'
        },
        reports: [
          {status: 'SENT'},
          {status: 'FAILED'}
        ]
      })
    ).toBe('DELIVERY_ISSUE');
  });

  it('ignores superseded draft revisions when deriving delivery status', () => {
    expect(
      deriveReportContextStatus({
        submissionCount: 2,
        batch: {
          status: 'FINALIZED'
        },
        reports: [
          {status: 'DRAFT'},
          {status: 'SENT'}
        ]
      })
    ).toBe('SENT');
  });

  it('returns waiting when an unfinished batch has no submitted source', () => {
    expect(
      deriveReportContextStatus({
        submissionCount: 0,
        batch: {
          status: 'DRAFT'
        },
        reports: []
      })
    ).toBe('WAITING');
  });

  it('lists only actual teaching contexts and keeps groups separate', () => {
    const contexts = deriveAdminReportContexts({
      classes,
      assignments: [
        {
          teacherId: 'teacher-1',
          classSubjectId: 'subject-1',
          subjectGroupId: null
        },
        {
          teacherId: 'teacher-2',
          classSubjectId: 'subject-2',
          subjectGroupId: 'group-1'
        }
      ],
      teacherNames: new Map([
        ['teacher-1', 'Teacher One'],
        ['teacher-2', 'Teacher Two']
      ]),
      submissions: [
        {
          id: 'submission-1',
          teacherId: 'teacher-1',
          classSubjectId: 'subject-1',
          subjectGroupId: null
        },
        {
          id: 'submission-2',
          teacherId: 'teacher-2',
          classSubjectId: 'subject-2',
          subjectGroupId: 'group-1'
        }
      ],
      batches: [
        {
          id: 'batch-1',
          classId: 'class-1',
          classSubjectId: 'subject-1',
          subjectGroupId: null,
          scopeType: 'SUBJECT',
          status: 'FINALIZED',
          createdAt: '2026-09-27T12:00:00Z'
        }
      ],
      reports: [
        {
          batchId: 'batch-1',
          status: 'READY'
        }
      ],
      observations: [
        {
          submissionId: 'submission-1',
          studentId: 'student-1',
          commentEn: 'Strong week',
          commentAr: null
        },
        {
          submissionId: 'submission-1',
          studentId: 'student-2',
          commentEn: '  ',
          commentAr: null
        }
      ]
    });

    expect(contexts).toHaveLength(2);

    const quran = contexts.find(
      ({classSubjectId}) => classSubjectId === 'subject-1'
    );

    const arabicGroupA = contexts.find(
      ({classSubjectId, subjectGroupId}) =>
        classSubjectId === 'subject-2' &&
        subjectGroupId === 'group-1'
    );

    expect(quran).toMatchObject({
      classSubjectId: 'subject-1',
      subjectGroupId: null,
      teacherNames: ['Teacher One'],
      submissionCount: 1,
      studentCommentCount: 1,
      batchId: 'batch-1',
      status: 'READY_TO_SEND'
    });

    expect(arabicGroupA).toMatchObject({
      classSubjectId: 'subject-2',
      subjectGroupId: 'group-1',
      groupNameEn: 'Group A',
      teacherNames: ['Teacher Two'],
      submissionCount: 1,
      batchId: null,
      status: 'READY_FOR_REVIEW'
    });

    expect(
      contexts.some(
        ({subjectGroupId}) => subjectGroupId === 'group-2'
      )
    ).toBe(false);
  });

  it('shows an assigned context as waiting before submission', () => {
    const contexts = deriveAdminReportContexts({
      classes,
      assignments: [
        {
          teacherId: 'teacher-1',
          classSubjectId: 'subject-1',
          subjectGroupId: null
        }
      ],
      teacherNames: new Map([
        ['teacher-1', 'Teacher One']
      ]),
      submissions: [],
      batches: [],
      reports: [],
      observations: []
    });

    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.status).toBe('WAITING');
  });
});
