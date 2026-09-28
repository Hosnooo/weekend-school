'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {z} from 'zod';

import {classSchema,classSubjectSchema,defaultGroupSchema,subjectGroupSchema,subjectSchema} from '@/features/classes/class.schemas';
import {archiveTeacherSubjectGroup,createTeacherSubjectGroup,moveTeacherSubjectGroupStudent,removeTeacherSubjectGroupStudent,renameTeacherSubjectGroup,restoreTeacherSubjectGroup,setManagedRecordActive,updateClassRecord,updateSubjectGroupRecord,updateSubjectRecord} from '@/features/classes/class.repository';
import {addSubjectToClass,changeDefaultGroup,createClassForSchool,createGroupForClassSubject,createSubjectForSchool} from '@/features/classes/class.service';
import {isLocale} from '@/i18n/config';
import {requireProfile,requireTeachingAccount} from '@/lib/auth/require-profile';
import type {ActionState} from '@/lib/validation/action-state';
import {saveFailure,validationFailure} from '@/lib/validation/action-state';
import {databaseUuid} from '@/lib/validation/fields';

function localeFrom(formData:FormData){const value=String(formData.get('locale')??'en');return isLocale(value)?value:'en';}
function classIdFrom(formData:FormData){return databaseUuid.safeParse(formData.get('classId'));}
function refresh(locale:'en'|'ar',classId?:string){revalidatePath(`/${locale}/classes`);if(classId)revalidatePath(`/${locale}/classes/${classId}`);revalidatePath(`/${locale}/archives`);}

export async function createClassAction(_state:ActionState,formData:FormData):Promise<ActionState>{const locale=localeFrom(formData);const profile=await requireProfile(locale,'ADMIN');const parsed=classSchema.safeParse({nameEn:formData.get('nameEn'),nameAr:formData.get('nameAr'),startsOn:formData.get('startsOn'),endsOn:formData.get('endsOn')});if(!parsed.success)return validationFailure();let classId:string;try{classId=await createClassForSchool(profile.schoolId,parsed.data);}catch(error){console.error('Unable to create class',{error});return saveFailure();}refresh(locale);redirect(`/${locale}/classes/${classId}`);}
export async function createSubjectAction(_state:ActionState,formData:FormData):Promise<ActionState>{const locale=localeFrom(formData);const profile=await requireProfile(locale,'ADMIN');const classId=classIdFrom(formData);const parsed=subjectSchema.safeParse({nameEn:formData.get('nameEn'),nameAr:formData.get('nameAr')});if(!classId.success||!parsed.success)return validationFailure();try{const subjectId=await createSubjectForSchool(profile.schoolId,parsed.data);await addSubjectToClass(profile.schoolId,classId.data,{subjectId});}catch(error){console.error('Unable to create and add subject',{error});return saveFailure();}refresh(locale,classId.data);redirect(`/${locale}/classes/${classId.data}`);}
export async function addClassSubjectAction(_state:ActionState,formData:FormData):Promise<ActionState>{const locale=localeFrom(formData);const profile=await requireProfile(locale,'ADMIN');const classId=classIdFrom(formData);const parsed=classSubjectSchema.safeParse({subjectId:formData.get('subjectId')});if(!classId.success||!parsed.success)return validationFailure();try{await addSubjectToClass(profile.schoolId,classId.data,parsed.data);}catch(error){console.error('Unable to add subject to class',{error});return saveFailure();}refresh(locale,classId.data);redirect(`/${locale}/classes/${classId.data}`);}
export async function createSubjectGroupAction(_state:ActionState,formData:FormData):Promise<ActionState>{const locale=localeFrom(formData);await requireProfile(locale,'ADMIN');const classId=classIdFrom(formData);const parsed=subjectGroupSchema.safeParse({classSubjectId:formData.get('classSubjectId'),nameEn:formData.get('nameEn'),nameAr:formData.get('nameAr')});if(!classId.success||!parsed.success)return validationFailure();try{await createGroupForClassSubject(parsed.data);}catch(error){console.error('Unable to create subject group',{error});return saveFailure();}refresh(locale,classId.data);redirect(`/${locale}/classes/${classId.data}`);}
export async function setDefaultGroupAction(formData:FormData){const locale=localeFrom(formData);const profile=await requireProfile(locale,'ADMIN');const parsed=z.object({classId:databaseUuid,classSubjectId:defaultGroupSchema.shape.classSubjectId,subjectGroupId:defaultGroupSchema.shape.subjectGroupId}).safeParse({classId:formData.get('classId'),classSubjectId:formData.get('classSubjectId'),subjectGroupId:formData.get('subjectGroupId')});if(!parsed.success)return;await changeDefaultGroup(profile.schoolId,{classSubjectId:parsed.data.classSubjectId,subjectGroupId:parsed.data.subjectGroupId});refresh(locale,parsed.data.classId);}

export async function updateClassAction(formData:FormData){const locale=localeFrom(formData);const profile=await requireProfile(locale,'ADMIN');const id=databaseUuid.safeParse(formData.get('classId'));const parsed=classSchema.safeParse({nameEn:formData.get('nameEn'),nameAr:formData.get('nameAr'),startsOn:formData.get('startsOn'),endsOn:formData.get('endsOn')});if(!id.success||!parsed.success)return;await updateClassRecord(profile.schoolId,id.data,parsed.data);refresh(locale,id.data);}
export async function setClassActiveAction(formData:FormData){const locale=localeFrom(formData);await requireProfile(locale,'ADMIN');const parsed=z.object({classId:databaseUuid,isActive:z.enum(['true','false'])}).safeParse({classId:formData.get('classId'),isActive:formData.get('isActive')});if(!parsed.success)return;await setManagedRecordActive('CLASS',parsed.data.classId,parsed.data.isActive==='true');refresh(locale,parsed.data.classId);}
export async function updateSubjectAction(formData:FormData){const locale=localeFrom(formData);const profile=await requireProfile(locale,'ADMIN');const parsed=z.object({classId:databaseUuid,subjectId:databaseUuid,nameEn:subjectSchema.shape.nameEn,nameAr:subjectSchema.shape.nameAr}).safeParse({classId:formData.get('classId'),subjectId:formData.get('subjectId'),nameEn:formData.get('nameEn'),nameAr:formData.get('nameAr')});if(!parsed.success)return;await updateSubjectRecord(profile.schoolId,parsed.data.subjectId,{nameEn:parsed.data.nameEn,nameAr:parsed.data.nameAr});refresh(locale,parsed.data.classId);}
export async function setSubjectActiveAction(formData:FormData){const locale=localeFrom(formData);await requireProfile(locale,'ADMIN');const parsed=z.object({classId:databaseUuid,subjectId:databaseUuid,isActive:z.enum(['true','false'])}).safeParse({classId:formData.get('classId'),subjectId:formData.get('subjectId'),isActive:formData.get('isActive')});if(!parsed.success)return;await setManagedRecordActive('SUBJECT',parsed.data.subjectId,parsed.data.isActive==='true');refresh(locale,parsed.data.classId);}
export async function updateSubjectGroupAction(formData:FormData){const locale=localeFrom(formData);const profile=await requireProfile(locale,'ADMIN');const parsed=z.object({classId:databaseUuid,subjectGroupId:databaseUuid,nameEn:subjectSchema.shape.nameEn,nameAr:subjectSchema.shape.nameAr}).safeParse({classId:formData.get('classId'),subjectGroupId:formData.get('subjectGroupId'),nameEn:formData.get('nameEn'),nameAr:formData.get('nameAr')});if(!parsed.success)return;await updateSubjectGroupRecord(profile.schoolId,parsed.data.subjectGroupId,{nameEn:parsed.data.nameEn,nameAr:parsed.data.nameAr});refresh(locale,parsed.data.classId);}
export async function setSubjectGroupActiveAction(formData:FormData){const locale=localeFrom(formData);await requireProfile(locale,'ADMIN');const parsed=z.object({classId:databaseUuid,subjectGroupId:databaseUuid,isActive:z.enum(['true','false'])}).safeParse({classId:formData.get('classId'),subjectGroupId:formData.get('subjectGroupId'),isActive:formData.get('isActive')});if(!parsed.success)return;await setManagedRecordActive('GROUP',parsed.data.subjectGroupId,parsed.data.isActive==='true');refresh(locale,parsed.data.classId);}


function refreshTeacherGroups(locale:'en'|'ar'){
  revalidatePath(`/${locale}/my-teaching`);
}

export async function createTeacherSubjectGroupAction(formData:FormData){
  const locale=localeFrom(formData);
  await requireTeachingAccount(locale);
  const parsed=subjectGroupSchema.safeParse({
    classSubjectId:formData.get('classSubjectId'),
    nameEn:formData.get('nameEn'),
    nameAr:formData.get('nameAr')
  });
  if(!parsed.success)return;
  await createTeacherSubjectGroup(parsed.data);
  refreshTeacherGroups(locale);
}

export async function renameTeacherSubjectGroupAction(formData:FormData){
  const locale=localeFrom(formData);
  await requireTeachingAccount(locale);
  const parsed=z.object({
    subjectGroupId:databaseUuid,
    nameEn:subjectSchema.shape.nameEn,
    nameAr:subjectSchema.shape.nameAr
  }).safeParse({
    subjectGroupId:formData.get('subjectGroupId'),
    nameEn:formData.get('nameEn'),
    nameAr:formData.get('nameAr')
  });
  if(!parsed.success)return;
  await renameTeacherSubjectGroup(parsed.data);
  refreshTeacherGroups(locale);
}

export async function archiveTeacherSubjectGroupAction(formData:FormData){
  const locale=localeFrom(formData);
  await requireTeachingAccount(locale);
  const parsed=databaseUuid.safeParse(formData.get('subjectGroupId'));
  if(!parsed.success)return;
  await archiveTeacherSubjectGroup(parsed.data);
  refreshTeacherGroups(locale);
}

export async function restoreTeacherSubjectGroupAction(formData:FormData){
  const locale=localeFrom(formData);
  await requireTeachingAccount(locale);
  const parsed=databaseUuid.safeParse(formData.get('subjectGroupId'));
  if(!parsed.success)return;
  await restoreTeacherSubjectGroup(parsed.data);
  refreshTeacherGroups(locale);
}

export async function moveTeacherSubjectGroupStudentAction(formData:FormData){
  const locale=localeFrom(formData);
  await requireTeachingAccount(locale);
  const parsed=z.object({
    classSubjectId:databaseUuid,
    studentId:databaseUuid,
    subjectGroupId:databaseUuid,
    onDate:z.iso.date()
  }).safeParse({
    classSubjectId:formData.get('classSubjectId'),
    studentId:formData.get('studentId'),
    subjectGroupId:formData.get('subjectGroupId'),
    onDate:formData.get('onDate')
  });
  if(!parsed.success)return;
  await moveTeacherSubjectGroupStudent(parsed.data);
  refreshTeacherGroups(locale);
}

export async function removeTeacherSubjectGroupStudentAction(formData:FormData){
  const locale=localeFrom(formData);
  await requireTeachingAccount(locale);
  const parsed=z.object({
    classSubjectId:databaseUuid,
    studentId:databaseUuid,
    onDate:z.iso.date()
  }).safeParse({
    classSubjectId:formData.get('classSubjectId'),
    studentId:formData.get('studentId'),
    onDate:formData.get('onDate')
  });
  if(!parsed.success)return;
  await removeTeacherSubjectGroupStudent(parsed.data);
  refreshTeacherGroups(locale);
}
