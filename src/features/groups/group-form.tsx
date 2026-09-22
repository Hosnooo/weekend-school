'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {createGroupAction, updateGroupAction} from '@/features/groups/group.actions';
import type {GroupListItem} from '@/features/groups/group.types';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {initialActionState} from '@/lib/validation/action-state';

export function GroupForm({locale, group, groups, teachers}: {locale: Locale; group?: GroupListItem; groups: GroupListItem[]; teachers: Array<{id:string;displayName:string}>}) {
  const t=useTranslations('groups'); const common=useTranslations('common');
  const [state, action, pending]=useActionState(group ? updateGroupAction : createGroupAction, initialActionState);
  const groupName=(item: GroupListItem)=>locale==='ar'&&item.nameAr?item.nameAr:item.nameEn;
  return <form action={action} className="record-form"><input name="locale" type="hidden" value={locale}/>{group?<input name="id" type="hidden" value={group.id}/>:null}<div className="form-grid">
    <label>{t('nameEn')}<input defaultValue={group?.nameEn} name="nameEn" required/></label><label>{t('nameAr')}<input defaultValue={group?.nameAr??''} dir="rtl" name="nameAr"/></label>
    <label>{t('parent')}<select defaultValue={group?.parentGroupId??''} name="parentGroupId"><option value="">{common('none')}</option>{groups.filter((item)=>item.id!==group?.id).map((item)=><option key={item.id} value={item.id}>{groupName(item)}</option>)}</select></label>
    <label>{t('teacher')}<select defaultValue={group?.primaryTeacher?.id??''} name="teacherProfileId"><option value="">{common('notAssigned')}</option>{teachers.map((item)=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
  </div><FormFeedback state={state}/><div className="form-actions"><Button disabled={pending}>{pending?common('saving'):common('save')}</Button><Link className="button button-secondary action-link" href="/groups">{common('cancel')}</Link></div></form>;
}
