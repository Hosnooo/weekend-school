import 'server-only';

import type {GroupInput} from '@/features/groups/group.schemas';
import type {MembershipInput} from '@/features/groups/membership.schemas';
import type {
  GroupListItem,
  GroupMembershipListItem
} from '@/features/groups/group.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type GroupRow = {
  id: string;
  name_en: string;
  name_ar: string | null;
  parent_group_id: string | null;
  is_active: boolean;
  group_teachers: Array<{
    assignment_type: 'PRIMARY' | 'ASSISTANT';
    profiles: {id: string; display_name: string} | null;
  }>;
  group_memberships: Array<{ends_on: string | null}>;
};

const groupSelect = `
  id,
  name_en,
  name_ar,
  parent_group_id,
  is_active,
  group_teachers(assignment_type, profiles(id, display_name)),
  group_memberships(ends_on)
`;

function mapGroup(row: GroupRow): GroupListItem {
  const teacher = row.group_teachers.find(
    ({assignment_type}) => assignment_type === 'PRIMARY'
  )?.profiles;
  return {
    id: row.id,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    parentGroupId: row.parent_group_id,
    isActive: row.is_active,
    primaryTeacher: teacher ? {id: teacher.id, displayName: teacher.display_name} : null,
    currentStudentCount: row.group_memberships.filter(({ends_on}) => ends_on === null).length
  };
}

export async function listGroups(schoolId: string) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('groups')
    .select(groupSelect)
    .eq('school_id', schoolId)
    .order('name_en');
  if (error) throw error;
  return (data as unknown as GroupRow[]).map(mapGroup);
}

export async function getGroup(schoolId: string, id: string) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('groups')
    .select(groupSelect)
    .eq('school_id', schoolId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapGroup(data as unknown as GroupRow) : null;
}

export async function createGroup(input: GroupInput) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase.rpc('create_group_with_teacher', {
    p_name_en: input.nameEn,
    p_name_ar: input.nameAr ?? '',
    p_parent_group_id: input.parentGroupId,
    p_teacher_profile_id: input.teacherProfileId
  });
  if (error) throw error;
  return data as string;
}

export async function updateGroup(id: string, input: GroupInput) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('update_group_with_teacher', {
    p_group_id: id,
    p_name_en: input.nameEn,
    p_name_ar: input.nameAr ?? '',
    p_parent_group_id: input.parentGroupId,
    p_teacher_profile_id: input.teacherProfileId
  });
  if (error) throw error;
}

export async function setGroupActive(schoolId: string, id: string, isActive: boolean) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase
    .from('groups')
    .update({is_active: isActive})
    .eq('school_id', schoolId)
    .eq('id', id);
  if (error) throw error;
}

export async function addMembership(schoolId: string, input: MembershipInput) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.from('group_memberships').insert({
    school_id: schoolId,
    group_id: input.groupId,
    student_id: input.studentId,
    starts_on: input.startsOn,
    ends_on: input.endsOn
  });
  if (error) throw error;
}

export async function listGroupMemberships(schoolId: string, groupId: string) {
  const supabase = await createServerSupabaseClient();
  const {data, error} = await supabase
    .from('group_memberships')
    .select('id, student_id, starts_on, ends_on, students(first_name_en, last_name_en, first_name_ar, last_name_ar)')
    .eq('school_id', schoolId)
    .eq('group_id', groupId)
    .order('starts_on', {ascending: false});
  if (error) throw error;

  return (data as unknown as Array<{
    id: string;
    student_id: string;
    starts_on: string;
    ends_on: string | null;
    students: {
      first_name_en: string;
      last_name_en: string;
      first_name_ar: string | null;
      last_name_ar: string | null;
    } | null;
  }>).flatMap((row): GroupMembershipListItem[] => row.students ? [{
    id: row.id,
    studentId: row.student_id,
    studentNameEn: `${row.students.first_name_en} ${row.students.last_name_en}`,
    studentNameAr: row.students.first_name_ar && row.students.last_name_ar
      ? `${row.students.first_name_ar} ${row.students.last_name_ar}`
      : null,
    startsOn: row.starts_on,
    endsOn: row.ends_on
  }] : []);
}

export async function endMembership(
  schoolId: string,
  membershipId: string,
  endsOn: string
) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase
    .from('group_memberships')
    .update({ends_on: endsOn})
    .eq('school_id', schoolId)
    .eq('id', membershipId)
    .is('ends_on', null);
  if (error) throw error;
}
