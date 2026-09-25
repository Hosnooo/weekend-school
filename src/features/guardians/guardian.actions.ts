'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {createGuardian,setGuardianActive,updateGuardian} from '@/features/guardians/guardian.repository';
import {guardianSchema,guardianUpdateSchema} from '@/features/guardians/guardian.schemas';
import {isLocale} from '@/i18n/config';
import {requireProfile} from '@/lib/auth/require-profile';
import type {ActionState} from '@/lib/validation/action-state';
import {saveFailure,validationFailure} from '@/lib/validation/action-state';
import {databaseUuid} from '@/lib/validation/fields';

function localeFrom(formData:FormData){const value=String(formData.get('locale')??'en');return isLocale(value)?value:'en';}
function refresh(locale:'en'|'ar'){revalidatePath(`/${locale}/guardians`);revalidatePath(`/${locale}/students/guardians`);revalidatePath(`/${locale}/archives`);}
export async function createGuardianAction(_state:ActionState,formData:FormData):Promise<ActionState>{const locale=localeFrom(formData);const profile=await requireProfile(locale,'ADMIN');const parsed=guardianSchema.safeParse({name:formData.get('name'),email:formData.get('email'),reportLanguage:formData.get('reportLanguage')});if(!parsed.success)return validationFailure();try{await createGuardian(profile.schoolId,parsed.data);}catch(error){console.error('Unable to create guardian',{error});return saveFailure();}refresh(locale);redirect(`/${locale}/guardians`);}
export async function updateGuardianAction(_state:ActionState,formData:FormData):Promise<ActionState>{const locale=localeFrom(formData);const profile=await requireProfile(locale,'ADMIN');const parsed=guardianUpdateSchema.safeParse({id:formData.get('id'),name:formData.get('name'),email:formData.get('email'),reportLanguage:formData.get('reportLanguage')});if(!parsed.success)return validationFailure();try{await updateGuardian(profile.schoolId,parsed.data.id,parsed.data);}catch(error){console.error('Unable to update guardian',{error});return saveFailure();}refresh(locale);redirect(`/${locale}/guardians`);}
export async function setGuardianActiveAction(formData:FormData){const locale=localeFrom(formData);const profile=await requireProfile(locale,'ADMIN');const parsed=z.object({id:databaseUuid,isActive:z.enum(['true','false'])}).safeParse({id:formData.get('id'),isActive:formData.get('isActive')});if(!parsed.success)return;await setGuardianActive(profile.schoolId,parsed.data.id,parsed.data.isActive==='true');refresh(locale);}
