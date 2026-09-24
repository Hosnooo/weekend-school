import 'server-only';

import type {
  ClassInput,
  ClassSubjectInput,
  DefaultGroupInput,
  SubjectGroupInput,
  SubjectInput
} from '@/features/classes/class.schemas';
import {
  insertClass,
  insertClassSubject,
  insertSubject,
  insertSubjectGroup,
  updateDefaultGroup
} from '@/features/classes/class.repository';

export async function createClassForSchool(schoolId: string, input: ClassInput) {
  return insertClass(schoolId, input);
}

export async function createSubjectForSchool(schoolId: string, input: SubjectInput) {
  return insertSubject(schoolId, input);
}

export async function addSubjectToClass(
  schoolId: string,
  classId: string,
  input: ClassSubjectInput
) {
  return insertClassSubject(schoolId, classId, input);
}

export async function createGroupForClassSubject(input: SubjectGroupInput) {
  return insertSubjectGroup(input);
}

export async function changeDefaultGroup(
  schoolId: string,
  input: DefaultGroupInput
) {
  return updateDefaultGroup(schoolId, input);
}
