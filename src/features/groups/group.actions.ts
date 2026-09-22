'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {
  addMembership,
  createGroup,
  endMembership,
  setGroupActive,
  updateGroup
} from '@/features/groups/group.repository';
import {groupSchema, groupUpdateSchema} from '@/features/groups/group.schemas';
import {membershipSchema} from '@/features/groups/membership.schemas';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import type {ActionState} from '@/lib/validation/action-state';
import {saveFailure, validationFailure} from '@/lib/validation/action-state';
import {databaseUuid} from '@/lib/validation/fields';

function localeFrom(formData: FormData) {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

function groupInput(formData: FormData) {
  return {
    nameEn: formData.get('nameEn'),
    nameAr: formData.get('nameAr'),
    parentGroupId: formData.get('parentGroupId'),
    teacherProfileId: formData.get('teacherProfileId')
  };
}

export async function createGroupAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  const parsed = groupSchema.safeParse(groupInput(formData));
  if (!parsed.success) return validationFailure();
  try {
    await createGroup(parsed.data);
  } catch (error) {
    console.error('Unable to create group', {error});
    return saveFailure();
  }
  revalidatePath(`/${locale}/groups`);
  redirect(`/${locale}/groups`);
}

export async function updateGroupAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  await requireProfile(locale, 'ADMIN');
  const parsed = groupUpdateSchema.safeParse({id: formData.get('id'), ...groupInput(formData)});
  if (!parsed.success) return validationFailure();
  try {
    await updateGroup(parsed.data.id, parsed.data);
  } catch (error) {
    console.error('Unable to update group', {error});
    return saveFailure();
  }
  revalidatePath(`/${locale}/groups`);
  redirect(`/${locale}/groups`);
}

export async function setGroupActiveAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = z.object({id: databaseUuid, isActive: z.enum(['true', 'false'])}).safeParse({
    id: formData.get('id'),
    isActive: formData.get('isActive')
  });
  if (!parsed.success) return;
  await setGroupActive(profile.schoolId, parsed.data.id, parsed.data.isActive === 'true');
  revalidatePath(`/${locale}/groups`);
}

export async function addMembershipAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = membershipSchema.safeParse({
    groupId: formData.get('groupId'),
    studentId: formData.get('studentId'),
    startsOn: formData.get('startsOn'),
    endsOn: formData.get('endsOn')
  });
  if (!parsed.success) return validationFailure();
  try {
    await addMembership(profile.schoolId, parsed.data);
  } catch (error) {
    console.error('Unable to add group membership', {error});
    return saveFailure();
  }
  revalidatePath(`/${locale}/groups/${parsed.data.groupId}/edit`);
  redirect(`/${locale}/groups/${parsed.data.groupId}/edit`);
}

export async function endMembershipAction(formData: FormData) {
  const locale = localeFrom(formData);
  const profile = await requireProfile(locale, 'ADMIN');
  const parsed = z.object({
    groupId: databaseUuid,
    membershipId: databaseUuid,
    endsOn: z.iso.date()
  }).safeParse({
    groupId: formData.get('groupId'),
    membershipId: formData.get('membershipId'),
    endsOn: formData.get('endsOn')
  });
  if (!parsed.success) return;
  await endMembership(profile.schoolId, parsed.data.membershipId, parsed.data.endsOn);
  revalidatePath(`/${locale}/groups/${parsed.data.groupId}/edit`);
}
