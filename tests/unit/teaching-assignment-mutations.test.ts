import {describe, expect, it} from 'vitest';

import {teachingAssignmentSchema} from '@/features/teaching-assignments/teaching-assignment.schemas';
import {
  classifyTeachingAssignmentMutationError,
  teachingAssignmentProtectsSubmittedHistory
} from '@/features/teaching-assignments/teaching-assignment.service';
import type {TeachingAssignment} from '@/features/teaching-assignments/teaching-assignment.types';

const assignment: TeachingAssignment = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  teacherId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  classSubjectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  subjectGroupId: null,
  startsOn: '2026-09-10',
  endsOn: '2026-09-20'
};

describe('teaching assignment mutation errors', () => {
  it.each([
    [{code: '23P01', message: 'conflicting key value violates exclusion constraint "teaching_assignments_no_duplicate_overlap"'}, 'overlap'],
    [{code: '23514', message: 'assignment end date cannot be before start date'}, 'invalid-range'],
    [{code: '23514', message: 'assignment date change would invalidate submitted teaching history'}, 'protected-history'],
    [{code: 'P0002', message: 'teaching assignment not found'}, 'not-found'],
    [{code: '23503', message: 'insert or update on table violates foreign key constraint'}, 'not-found'],
    [{code: '42501', message: 'administrator access required'}, 'forbidden'],
    [new Error('connection reset'), 'unexpected']
  ] as const)('classifies persistence failure %j as %s', (error, expected) => {
    expect(classifyTeachingAssignmentMutationError(error)).toBe(expected);
  });

  it('creates assignments from Teacher + Class Subject + dates without Group scope', () => {
    const parsed = teachingAssignmentSchema.parse({
      teacherId: assignment.teacherId,
      classSubjectId: assignment.classSubjectId,
      subjectGroupId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      startsOn: '2026-09-10',
      endsOn: '2026-09-20'
    });

    expect(parsed).toEqual({
      teacherId: assignment.teacherId,
      classSubjectId: assignment.classSubjectId,
      startsOn: '2026-09-10',
      endsOn: '2026-09-20'
    });
  });

  it('accepts an optional end date when creating an assignment', () => {
    expect(teachingAssignmentSchema.parse({
      teacherId: assignment.teacherId,
      classSubjectId: assignment.classSubjectId,
      startsOn: '2026-09-10',
      endsOn: '2026-09-20'
    })).toEqual({
      teacherId: assignment.teacherId,
      classSubjectId: assignment.classSubjectId,
      startsOn: '2026-09-10',
      endsOn: '2026-09-20'
    });

    expect(teachingAssignmentSchema.parse({
      teacherId: assignment.teacherId,
      classSubjectId: assignment.classSubjectId,
      subjectGroupId: null,
      startsOn: '2026-09-10',
      endsOn: ''
    }).endsOn).toBeNull();
  });
});

describe('teaching assignment protected history', () => {
  it('protects submitted group history covered by a whole-subject assignment', () => {
    expect(teachingAssignmentProtectsSubmittedHistory(assignment, {
      classSubjectId: assignment.classSubjectId,
      subjectGroupId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      weekStart: '2026-09-14'
    })).toBe(true);
  });

  it('protects sibling Group history for a historical Group-scoped assignment', () => {
    const groupAssignment = {
      ...assignment,
      subjectGroupId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    };

    expect(teachingAssignmentProtectsSubmittedHistory(groupAssignment, {
      classSubjectId: assignment.classSubjectId,
      subjectGroupId: groupAssignment.subjectGroupId,
      weekStart: '2026-09-14'
    })).toBe(true);

    expect(teachingAssignmentProtectsSubmittedHistory(groupAssignment, {
      classSubjectId: assignment.classSubjectId,
      subjectGroupId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      weekStart: '2026-09-14'
    })).toBe(true);
  });

  it('uses week-overlap semantics rather than requiring the assignment on week start', () => {
    expect(teachingAssignmentProtectsSubmittedHistory({
      ...assignment,
      startsOn: '2026-09-16',
      endsOn: '2026-09-18'
    }, {
      classSubjectId: assignment.classSubjectId,
      subjectGroupId: null,
      weekStart: '2026-09-14'
    })).toBe(true);

    expect(teachingAssignmentProtectsSubmittedHistory(assignment, {
      classSubjectId: assignment.classSubjectId,
      subjectGroupId: null,
      weekStart: '2026-09-21'
    })).toBe(false);
  });
});
