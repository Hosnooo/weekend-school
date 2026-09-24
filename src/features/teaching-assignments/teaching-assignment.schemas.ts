import {z} from 'zod';

import {databaseUuid, optionalUuid} from '@/lib/validation/fields';

export const teachingAssignmentSchema = z.object({
  teacherProfileId: databaseUuid,
  classSubjectId: databaseUuid,
  subjectGroupId: optionalUuid,
  startsOn: z.iso.date()
});

export const endTeachingAssignmentSchema = z.object({
  assignmentId: databaseUuid,
  endsOn: z.iso.date()
});

export type TeachingAssignmentInput = z.infer<typeof teachingAssignmentSchema>;
export type EndTeachingAssignmentInput = z.infer<typeof endTeachingAssignmentSchema>;
