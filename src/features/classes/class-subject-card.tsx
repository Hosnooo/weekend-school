import {getTranslations} from 'next-intl/server';

import {
  setDefaultGroupAction,
  setSubjectActiveAction,
  setSubjectGroupActiveAction,
  updateSubjectAction,
  updateSubjectGroupAction
} from '@/features/classes/class.actions';
import type {ClassSubjectSummary} from '@/features/classes/class.types';
import {SubjectGroupForm} from '@/features/classes/subject-group-form';
import type {Locale} from '@/i18n/config';

export async function ClassSubjectCard({locale,classId,subject}:{locale:Locale;classId:string;subject:ClassSubjectSummary}){
  const [t,common]=await Promise.all([getTranslations({locale,namespace:'classes'}),getTranslations({locale,namespace:'common'})]);
  const subjectName=locale==='ar'&&subject.subjectNameAr?subject.subjectNameAr:subject.subjectNameEn;
  const copy=locale==='ar'?{renameSubject:'تعديل اسم المادة',renameGroup:'تعديل المجموعة',save:'حفظ',archive:'أرشفة',restore:'استعادة'}:{renameSubject:'Rename subject',renameGroup:'Rename group',save:'Save',archive:'Archive',restore:'Restore'};
  return <article className="subject-card">
    <header className="subject-card-heading"><div><h3>{subjectName}</h3><p className="muted-text">{subject.groups.length===0?t('wholeClass'):t('groupCount',{count:subject.groups.length})}{' · '}{t('teacherCount',{count:subject.teacherCount})}</p></div><span className={`status-badge ${subject.isActive?'status-active':'status-inactive'}`}>{subject.isActive?common('active'):common('inactive')}</span></header>

    <details className="disclosure-card"><summary>{copy.renameSubject}</summary><form action={updateSubjectAction} className="form-grid"><input name="locale" type="hidden" value={locale}/><input name="classId" type="hidden" value={classId}/><input name="subjectId" type="hidden" value={subject.subjectId}/><label>{t('subjectNameEn')}<input defaultValue={subject.subjectNameEn} name="nameEn" required/></label><label>{t('subjectNameAr')}<input defaultValue={subject.subjectNameAr??''} name="nameAr"/></label><div className="form-actions"><button className="button button-secondary">{copy.save}</button></div></form></details>
    <form action={setSubjectActiveAction}><input name="locale" type="hidden" value={locale}/><input name="classId" type="hidden" value={classId}/><input name="subjectId" type="hidden" value={subject.subjectId}/><input name="isActive" type="hidden" value={String(!subject.isActive)}/><button className="text-button">{subject.isActive?copy.archive:copy.restore}</button></form>

    {subject.groups.length===0?<p className="empty-inline">{t('noGroups')}</p>:<><ul className="group-list">{subject.groups.map((group)=>{
      const groupName=locale==='ar'&&group.nameAr?group.nameAr:group.nameEn;
      return <li key={group.id} className="group-list-item"><div className="group-lifecycle"><span><strong>{groupName}</strong>{group.isDefault?<span className="status-badge status-active">{t('defaultGroup')}</span>:null}<span className={`status-badge ${group.isActive?'status-active':'status-inactive'}`}>{group.isActive?common('active'):common('inactive')}</span></span>
        <details className="disclosure-card"><summary>{copy.renameGroup}</summary><form action={updateSubjectGroupAction} className="form-grid"><input name="locale" type="hidden" value={locale}/><input name="classId" type="hidden" value={classId}/><input name="subjectGroupId" type="hidden" value={group.id}/><label>{t('groupNameEn')}<input defaultValue={group.nameEn} name="nameEn" required/></label><label>{t('groupNameAr')}<input defaultValue={group.nameAr??''} name="nameAr"/></label><button className="button button-secondary">{copy.save}</button></form></details></div>
        <div className="row-actions">{!group.isDefault&&group.isActive?<form action={setDefaultGroupAction}><input name="locale" type="hidden" value={locale}/><input name="classId" type="hidden" value={classId}/><input name="classSubjectId" type="hidden" value={subject.id}/><input name="subjectGroupId" type="hidden" value={group.id}/><button className="text-button">{t('makeDefault')}</button></form>:null}<form action={setSubjectGroupActiveAction}><input name="locale" type="hidden" value={locale}/><input name="classId" type="hidden" value={classId}/><input name="subjectGroupId" type="hidden" value={group.id}/><input name="isActive" type="hidden" value={String(!group.isActive)}/><button className="text-button">{group.isActive?copy.archive:copy.restore}</button></form></div>
      </li>;
    })}</ul><p className="form-hint">{t('defaultGroupHelp')}</p></>}

    {subject.isActive?<details className="disclosure-card"><summary>{t('addGroup')}</summary><SubjectGroupForm classId={classId} classSubjectId={subject.id} locale={locale}/></details>:null}
  </article>;
}
