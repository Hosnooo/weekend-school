'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import type {GroupListItem} from '@/features/groups/group.types';
import {createTeacherAction, updateTeacherAction} from '@/features/teachers/teacher.actions';
import type {TeacherListItem} from '@/features/teachers/teacher.types';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {initialActionState} from '@/lib/validation/action-state';

export function TeacherForm({locale, teacher, groups}: {locale: Locale; teacher?: TeacherListItem; groups: GroupListItem[]}) {
  const t=useTranslations('teachers'); const common=useTranslations('common'); const language=useTranslations('language');
  const [state, action, pending]=useActionState(teacher?updateTeacherAction:createTeacherAction, initialActionState);
  const selected=new Set(teacher?.assignedGroups.map(({id})=>id));
  return <form action={action} className="record-form"><input name="locale" type="hidden" value={locale}/>{teacher?<input name="id" type="hidden" value={teacher.id}/>:null}<div className="form-grid">
    <label>{t('displayName')}<input defaultValue={teacher?.displayName} name="displayName" required/></label>{!teacher?<label>{t('email')}<input autoComplete="email" name="email" required type="email"/></label>:null}
    <label>{t('preferredLanguage')}<select defaultValue={teacher?.preferredLanguage??'en'} name="preferredLanguage"><option value="en">{language('english')}</option><option value="ar">{language('arabic')}</option></select></label>
  </div><fieldset><legend>{t('assignments')}</legend><div className="check-list">{groups.filter(({isActive})=>isActive).map((group)=><label className="check-item" key={group.id}><input defaultChecked={selected.has(group.id)} name="assignedGroupIds" type="checkbox" value={group.id}/><span>{locale==='ar'&&group.nameAr?group.nameAr:group.nameEn}</span></label>)}</div></fieldset><FormFeedback state={state}/><div className="form-actions"><Button disabled={pending}>{pending?common('saving'):common('save')}</Button><Link className="button button-secondary action-link" href="/teachers">{common('cancel')}</Link></div></form>;
}
