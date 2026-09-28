import {z} from 'zod';

import {databaseUuid} from '@/lib/validation/fields';

const nullableDate = z.preprocess(
  (value) => value === '' || value === undefined ? null : value,
  z.iso.date().nullable()
);

export const teachingAssignmentSchema = z.object({
  teacherId: databaseUuid,
  classSubjectId: databaseUuid,
  startsOn: z.iso.date(),
  endsOn: nullableDate
});

export const endTeachingAssignmentSchema = z.object({
  assignmentId: databaseUuid,
  endsOn: z.iso.date()
});

export const updateTeachingAssignmentSchema = z.object({
  assignmentId: databaseUuid,
  startsOn: z.iso.date(),
  endsOn: nullableDate
});

export const deleteTeachingAssignmentSchema = z.object({
  assignmentId: databaseUuid
});

export type TeachingAssignmentInput = z.infer<typeof teachingAssignmentSchema>;
export type EndTeachingAssignmentInput = z.infer<typeof endTeachingAssignmentSchema>;
export type UpdateTeachingAssignmentInput = z.infer<typeof updateTeachingAssignmentSchema>;
export type DeleteTeachingAssignmentInput = z.infer<typeof deleteTeachingAssignmentSchema>;
