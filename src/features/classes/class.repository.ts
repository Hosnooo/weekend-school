import 'server-only';

import type {ClassDetail,ClassSummary,SubjectOption,TeacherSubjectGroupManagement} from '@/features/classes/class.types';
import type {ClassInput,ClassSubjectInput,DefaultGroupInput,SubjectGroupInput,SubjectInput} from '@/features/classes/class.schemas';
import {createServerSupabaseClient} from '@/lib/supabase/server';

type ClassListRow={id:string;name_en:string;name_ar:string|null;starts_on:string;ends_on:string|null;is_active:boolean;class_subjects:Array<{id:string;is_active:boolean}>;class_enrollments:Array<{starts_on:string;ends_on:string|null}>};
type ClassSubjectRow={id:string;subject_id:string;default_group_id:string|null;is_active:boolean;subjects:{name_en:string;name_ar:string|null}|null;subject_groups:Array<{id:string;name_en:string;name_ar:string|null;is_active:boolean}>;teaching_assignments:Array<{teacher_id:string;starts_on:string;ends_on:string|null}>};
const todayIso=()=>new Date().toISOString().slice(0,10);const includesDate=(startsOn:string,endsOn:string|null,date:string)=>startsOn<=date&&(endsOn===null||endsOn>=date);
export async function listClasses(schoolId:string):Promise<ClassSummary[]>{const db=await createServerSupabaseClient();const{data,error}=await db.from('classes').select('id,name_en,name_ar,starts_on,ends_on,is_active,class_subjects(id,is_active),class_enrollments(starts_on,ends_on)').eq('school_id',schoolId).order('name_en');if(error)throw error;const today=todayIso();return(data as unknown as ClassListRow[]).map((row)=>({id:row.id,nameEn:row.name_en,nameAr:row.name_ar,startsOn:row.starts_on,endsOn:row.ends_on,isActive:row.is_active,activeStudentCount:row.class_enrollments.filter(({starts_on,ends_on})=>includesDate(starts_on,ends_on,today)).length,subjectCount:row.class_subjects.filter(({is_active})=>is_active).length}));}
export async function getClassDetail(schoolId:string,classId:string):Promise<ClassDetail|null>{const db=await createServerSupabaseClient();const{data:classRow,error:classError}=await db.from('classes').select('id,name_en,name_ar,starts_on,ends_on,is_active').eq('school_id',schoolId).eq('id',classId).maybeSingle();if(classError)throw classError;if(!classRow)return null;const{data:subjectRows,error:subjectError}=await db.from('class_subjects').select('id,subject_id,default_group_id,is_active,subjects(name_en,name_ar),subject_groups!subject_groups_class_subject_school_fk(id,name_en,name_ar,is_active),teaching_assignments!teaching_assignments_class_subject_school_fk(teacher_id,starts_on,ends_on)').eq('school_id',schoolId).eq('class_id',classId).order('created_at');if(subjectError)throw subjectError;const today=todayIso();return{id:classRow.id as string,nameEn:classRow.name_en as string,nameAr:classRow.name_ar as string|null,startsOn:classRow.starts_on as string,endsOn:classRow.ends_on as string|null,isActive:classRow.is_active as boolean,subjects:(subjectRows as unknown as ClassSubjectRow[]).flatMap((row)=>row.subjects?[{id:row.id,subjectId:row.subject_id,subjectNameEn:row.subjects.name_en,subjectNameAr:row.subjects.name_ar,isActive:row.is_active,defaultGroupId:row.default_group_id,teacherCount:new Set(row.teaching_assignments.filter(({starts_on,ends_on})=>includesDate(starts_on,ends_on,today)).map(({teacher_id})=>teacher_id)).size,groups:row.subject_groups.map((group)=>({id:group.id,nameEn:group.name_en,nameAr:group.name_ar,isActive:group.is_active,isDefault:group.id===row.default_group_id})).sort((a,b)=>a.nameEn.localeCompare(b.nameEn))}]:[])};}
export async function listSubjects(schoolId:string):Promise<SubjectOption[]>{const db=await createServerSupabaseClient();const{data,error}=await db.from('subjects').select('id,name_en,name_ar').eq('school_id',schoolId).eq('is_active',true).order('name_en');if(error)throw error;return(data as Array<{id:string;name_en:string;name_ar:string|null}>).map((row)=>({id:row.id,nameEn:row.name_en,nameAr:row.name_ar}));}
export async function insertClass(schoolId:string,input:ClassInput){const db=await createServerSupabaseClient();const{data,error}=await db.from('classes').insert({school_id:schoolId,name_en:input.nameEn,name_ar:input.nameAr,starts_on:input.startsOn,ends_on:input.endsOn}).select('id').single();if(error)throw error;return data.id as string;}
export async function insertSubject(schoolId:string,input:SubjectInput){const db=await createServerSupabaseClient();const{data,error}=await db.from('subjects').insert({school_id:schoolId,name_en:input.nameEn,name_ar:input.nameAr}).select('id').single();if(error)throw error;return data.id as string;}
export async function insertClassSubject(schoolId:string,classId:string,input:ClassSubjectInput){const db=await createServerSupabaseClient();const{data,error}=await db.from('class_subjects').insert({school_id:schoolId,class_id:classId,subject_id:input.subjectId}).select('id').single();if(error)throw error;return data.id as string;}
export async function insertSubjectGroup(input:SubjectGroupInput){const db=await createServerSupabaseClient();const{data,error}=await db.rpc('create_subject_group',{p_class_subject_id:input.classSubjectId,p_name_en:input.nameEn,p_name_ar:input.nameAr});if(error)throw error;return data as string;}
export async function updateDefaultGroup(schoolId:string,input:DefaultGroupInput){const db=await createServerSupabaseClient();const{error}=await db.from('class_subjects').update({default_group_id:input.subjectGroupId}).eq('school_id',schoolId).eq('id',input.classSubjectId);if(error)throw error;}
export async function updateClassRecord(schoolId:string,id:string,input:ClassInput){const db=await createServerSupabaseClient();const{data,error}=await db.from('classes').update({name_en:input.nameEn,name_ar:input.nameAr,starts_on:input.startsOn,ends_on:input.endsOn}).eq('school_id',schoolId).eq('id',id).select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('Class not found');}
export async function updateSubjectRecord(schoolId:string,id:string,input:SubjectInput){const db=await createServerSupabaseClient();const{data,error}=await db.from('subjects').update({name_en:input.nameEn,name_ar:input.nameAr}).eq('school_id',schoolId).eq('id',id).select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('Subject not found');}
export async function updateSubjectGroupRecord(schoolId:string,id:string,input:{nameEn:string;nameAr:string|null}){const db=await createServerSupabaseClient();const{data,error}=await db.from('subject_groups').update({name_en:input.nameEn,name_ar:input.nameAr}).eq('school_id',schoolId).eq('id',id).select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('Group not found');}
export async function setManagedRecordActive(entityType:'CLASS'|'SUBJECT'|'GROUP',id:string,isActive:boolean){const db=await createServerSupabaseClient();if(isActive){const{error}=await db.rpc('restore_entity',{p_entity_type:entityType,p_entity_id:id});if(error)throw error;}else{const{error}=await db.rpc('archive_entity',{p_entity_type:entityType,p_entity_id:id});if(error)throw error;}}


export async function createTeacherSubjectGroup(input:{classSubjectId:string;nameEn:string;nameAr:string|null}) {
  const db=await createServerSupabaseClient();
  const {data,error}=await db.rpc('teacher_create_subject_group',{
    p_class_subject_id:input.classSubjectId,
    p_name_en:input.nameEn,
    p_name_ar:input.nameAr
  });
  if(error)throw error;
  return data as string;
}

export async function renameTeacherSubjectGroup(input:{subjectGroupId:string;nameEn:string;nameAr:string|null}) {
  const db=await createServerSupabaseClient();
  const {error}=await db.rpc('teacher_rename_subject_group',{
    p_subject_group_id:input.subjectGroupId,
    p_name_en:input.nameEn,
    p_name_ar:input.nameAr
  });
  if(error)throw error;
}

export async function archiveTeacherSubjectGroup(subjectGroupId:string) {
  const db=await createServerSupabaseClient();
  const {error}=await db.rpc('teacher_archive_subject_group',{
    p_subject_group_id:subjectGroupId
  });
  if(error)throw error;
}

export async function restoreTeacherSubjectGroup(subjectGroupId:string) {
  const db=await createServerSupabaseClient();
  const {error}=await db.rpc('teacher_restore_subject_group',{
    p_subject_group_id:subjectGroupId
  });
  if(error)throw error;
}

export async function moveTeacherSubjectGroupStudent(input:{
  classSubjectId:string;
  studentId:string;
  subjectGroupId:string;
  onDate:string;
}) {
  const db=await createServerSupabaseClient();
  const {error}=await db.rpc('teacher_move_subject_group_student',{
    p_class_subject_id:input.classSubjectId,
    p_student_id:input.studentId,
    p_subject_group_id:input.subjectGroupId,
    p_on_date:input.onDate
  });
  if(error)throw error;
}

export async function removeTeacherSubjectGroupStudent(input:{
  classSubjectId:string;
  studentId:string;
  onDate:string;
}) {
  const db=await createServerSupabaseClient();
  const {error}=await db.rpc('teacher_remove_subject_group_student',{
    p_class_subject_id:input.classSubjectId,
    p_student_id:input.studentId,
    p_on_date:input.onDate
  });
  if(error)throw error;
}

export async function listTeacherSubjectGroupManagement(
  classSubjectId:string,
  onDate:string
):Promise<TeacherSubjectGroupManagement> {
  const db=await createServerSupabaseClient();

  const [groupsResult,rosterResult,membershipsResult]=await Promise.all([
    db.from('subject_groups')
      .select('id,name_en,name_ar,is_active')
      .eq('class_subject_id',classSubjectId)
      .order('name_en'),
    db.rpc('get_weekly_submission_roster',{
      p_class_subject_id:classSubjectId,
      p_subject_group_id:null,
      p_on_date:onDate
    }),
    db.from('subject_group_memberships')
      .select(`
        id,
        student_id,
        subject_group_id,
        starts_on,
        ends_on,
        students(first_name_en,last_name_en,first_name_ar,last_name_ar),
        subject_groups!subject_group_memberships_group_context_fk(name_en,name_ar)
      `)
      .eq('class_subject_id',classSubjectId)
      .order('starts_on',{ascending:false})
  ]);

  if(groupsResult.error)throw groupsResult.error;
  if(rosterResult.error)throw rosterResult.error;
  if(membershipsResult.error)throw membershipsResult.error;

  const groups=(groupsResult.data as Array<{
    id:string;
    name_en:string;
    name_ar:string|null;
    is_active:boolean;
  }>).map((row)=>({
    id:row.id,
    nameEn:row.name_en,
    nameAr:row.name_ar,
    isActive:row.is_active
  }));

  const membershipRows=membershipsResult.data as unknown as Array<{
    id:string;
    student_id:string;
    subject_group_id:string;
    starts_on:string;
    ends_on:string|null;
    students:{
      first_name_en:string;
      last_name_en:string;
      first_name_ar:string|null;
      last_name_ar:string|null;
    }|null;
    subject_groups:{name_en:string;name_ar:string|null}|null;
  }>;

  const currentGroupByStudent=new Map<string,string>();
  for(const row of membershipRows){
    if(
      row.starts_on<=onDate &&
      (row.ends_on===null||row.ends_on>=onDate)
    ){
      currentGroupByStudent.set(row.student_id,row.subject_group_id);
    }
  }

  const students=(rosterResult.data as Array<{
    student_id:string;
    first_name_en:string;
    last_name_en:string;
    first_name_ar:string|null;
    last_name_ar:string|null;
  }>).map((row)=>({
    id:row.student_id,
    nameEn:`${row.first_name_en} ${row.last_name_en}`,
    nameAr:row.first_name_ar&&row.last_name_ar
      ?`${row.first_name_ar} ${row.last_name_ar}`
      :null,
    currentGroupId:currentGroupByStudent.get(row.student_id)??null
  }));

  return{
    classSubjectId,
    groups,
    students,
    membershipHistory:membershipRows.flatMap((row)=>{
      if(!row.students||!row.subject_groups)return[];
      return[{
        id:row.id,
        studentId:row.student_id,
        studentNameEn:`${row.students.first_name_en} ${row.students.last_name_en}`,
        studentNameAr:row.students.first_name_ar&&row.students.last_name_ar
          ?`${row.students.first_name_ar} ${row.students.last_name_ar}`
          :null,
        subjectGroupId:row.subject_group_id,
        groupNameEn:row.subject_groups.name_en,
        groupNameAr:row.subject_groups.name_ar,
        startsOn:row.starts_on,
        endsOn:row.ends_on
      }];
    })
  };
}
