import {z} from 'zod';

import {
  databaseUuid,
  optionalText,
  optionalUuid
} from '@/lib/validation/fields';
import {
  attendanceStatusSchema,
  performanceSchema
} from '@/features/weekly-updates/weekly-update.schemas';

export const teachingUpdateCoverageKindSchema =
  z.enum(['RANGE', 'DATES']);

const nullableVersion = z.preprocess(
  (value) =>
    value === '' || value === undefined || value === null
      ? null
      : value,
  z.coerce.number().int().positive().nullable()
);

export const teachingUpdateDraftSchema = z.object({
  teacherId: databaseUuid,
  submissionId: optionalUuid,
  classSubjectId: databaseUuid,
  subjectGroupId: optionalUuid,
  coverageKind: teachingUpdateCoverageKindSchema,
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  dates: z.array(z.iso.date()),
  progressEn: optionalText,
  progressAr: optionalText,
  defaultPerformance: performanceSchema.nullable(),
  attendance: z.array(
    z.object({
      studentId: databaseUuid,
      status: attendanceStatusSchema
    })
  ),
  exceptions: z.array(
    z.object({
      studentId: databaseUuid,
      performanceOverride: performanceSchema.nullable(),
      commentEn: optionalText,
      commentAr: optionalText
    })
  ),
  expectedVersion: nullableVersion
}).superRefine((value, context) => {
  if (value.periodEnd < value.periodStart) {
    context.addIssue({
      code: 'custom',
      path: ['periodEnd'],
      message: 'Coverage end date cannot precede its start date'
    });
  }

  const uniqueDates = [...new Set(value.dates)].sort();

  if (value.coverageKind === 'DATES') {
    if (uniqueDates.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['dates'],
        message: 'At least one exact date is required'
      });
      return;
    }

    if (
      uniqueDates[0] !== value.periodStart ||
      uniqueDates.at(-1) !== value.periodEnd
    ) {
      context.addIssue({
        code: 'custom',
        path: ['dates'],
        message: 'Exact dates must match the coverage bounds'
      });
    }
  }
});

export const teachingUpdateLifecycleSchema = z.object({
  teacherId: databaseUuid,
  submissionId: databaseUuid,
  expectedVersion: z.coerce.number().int().positive()
});

export const dismissTeachingUpdateSchema =
  teachingUpdateLifecycleSchema.extend({
    reason: optionalText
  });

export type TeachingUpdateDraftInput =
  z.infer<typeof teachingUpdateDraftSchema>;
