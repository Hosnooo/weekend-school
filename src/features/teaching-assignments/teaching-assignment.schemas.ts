import {z} from 'zod';
export const teachingAssignmentSchema=z.object({teacherProfileId:z.uuid(),classSubjectId:z.uuid(),subjectGroupId:z.uuid().nullable(),startsOn:z.iso.date()});
