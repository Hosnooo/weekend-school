'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {createStudentAction, updateStudentAction} from '@/features/students/student.actions';
import type {StudentListItem} from '@/features/students/student.types';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {initialActionState} from '@/lib/validation/action-state';

type GroupOption = {id: string; nameEn: string; nameAr: string | null};

export function StudentForm({locale, groups, student, today}: {
  locale: Locale;
  groups: GroupOption[];
  student?: StudentListItem;
  today: string;
}) {
  const t = useTranslations('students');
  const common = useTranslations('common');
  const [state, action, pending] = useActionState(student ? updateStudentAction : createStudentAction, initialActionState);
  const label = (group: GroupOption) => locale === 'ar' && group.nameAr ? group.nameAr : group.nameEn;

  return (
    <form action={action} className="record-form">
      <input name="locale" type="hidden" value={locale} />
      {student ? <input name="id" type="hidden" value={student.id} /> : null}
      <div className="form-grid">
        <label>{t('firstNameEn')}<input defaultValue={student?.firstNameEn} name="firstNameEn" required /></label>
        <label>{t('lastNameEn')}<input defaultValue={student?.lastNameEn} name="lastNameEn" required /></label>
        <label>{t('firstNameAr')}<input defaultValue={student?.firstNameAr ?? ''} dir="rtl" name="firstNameAr" /></label>
        <label>{t('lastNameAr')}<input defaultValue={student?.lastNameAr ?? ''} dir="rtl" name="lastNameAr" /></label>
      </div>
      {!student ? <>
        <fieldset><legend>{t('guardianSection')}</legend><div className="form-grid">
          <label>{t('guardianName')}<input name="guardianName" required /></label>
          <label>{t('guardianEmail')}<input autoComplete="email" name="guardianEmail" required type="email" /></label>
          <label>{t('reportLanguage')}<select defaultValue="en" name="reportLanguage"><option value="en">English</option><option value="ar">العربية</option><option value="both">English / العربية</option></select></label>
        </div></fieldset>
        <div className="form-grid">
          <label>{t('group')}<select name="groupId" required><option value="">—</option>{groups.map((group) => <option key={group.id} value={group.id}>{label(group)}</option>)}</select></label>
          <label>{t('membershipStart')}<input defaultValue={today} name="startsOn" required type="date" /></label>
        </div>
      </> : null}
      <FormFeedback state={state} />
      <div className="form-actions"><Button disabled={pending} type="submit">{pending ? common('saving') : common('save')}</Button><Link className="button button-secondary action-link" href="/students">{common('cancel')}</Link></div>
    </form>
  );
}
