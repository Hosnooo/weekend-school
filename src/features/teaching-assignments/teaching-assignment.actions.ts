'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {assignTeacher,updateTeachingAssignmentDates} from '@/features/teaching-assignments/teaching-assignment.repository';
import {teachingAssignmentSchema,updateTeachingAssignmentSchema} from '@/features/teaching-assignments/teaching-assignment.schemas';
import {validateTeachingAssignmentDateRange} from '@/features/teaching-assignments/teaching-assignment.service';
import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';
import type {ActionState} from '@/lib/validation/action-state';
import {initialActionState,saveFailure,validationFailure} from '@/lib/validation/action-state';
import {databaseUuid} from '@/lib/validation/fields';

function localeFrom(formData:FormData){const value=String(formData.get('locale')??'en');return isLocale(value)?value:'en';}
function refresh(locale:'en'|'ar',teacherId:string){revalidatePath(`/${locale}/teachers`);revalidatePath(`/${locale}/teaching-assignments`);revalidatePath(`/${locale}/teachers/${teacherId}/assignments`);revalidatePath(`/${locale}/teachers/${teacherId}/edit`);revalidatePath(`/${locale}/my-teaching`);}
export async function createTeachingAssignmentAction(_state:ActionState,formData:FormData):Promise<ActionState>{const locale=localeFrom(formData);const profile=await requireAdministrator(locale);const parsed=teachingAssignmentSchema.safeParse({teacherId:formData.get('teacherId'),classSubjectId:formData.get('classSubjectId'),subjectGroupId:formData.get('subjectGroupId'),startsOn:formData.get('startsOn')});if(!parsed.success)return validationFailure();try{await assignTeacher(profile.schoolId,parsed.data);}catch(error){console.error('Unable to add teaching assignment',{error});return saveFailure();}refresh(locale,parsed.data.teacherId);return initialActionState;}
export async function updateTeachingAssignmentAction(formData:FormData){const locale=localeFrom(formData);const profile=await requireAdministrator(locale);const teacherId=databaseUuid.safeParse(formData.get('teacherId'));const parsed=updateTeachingAssignmentSchema.safeParse({assignmentId:formData.get('assignmentId'),startsOn:formData.get('startsOn'),endsOn:formData.get('endsOn')});if(!teacherId.success||!parsed.success)return;try{validateTeachingAssignmentDateRange(parsed.data.startsOn,parsed.data.endsOn);await updateTeachingAssignmentDates(profile.schoolId,teacherId.data,parsed.data);}catch(error){console.error('Unable to update teaching assignment dates',{error});redirect(`/${locale}/teachers/${teacherId.data}/assignments?error=protected-history`);}refresh(locale,teacherId.data);}
