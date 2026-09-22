'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {moveStudentGroupAction} from '@/features/students/student.actions';
import type {StudentListItem} from '@/features/students/student.types';
import type {Locale} from '@/i18n/config';
import {initialActionState} from '@/lib/validation/action-state';

type GroupOption = {id: string; nameEn: string; nameAr: string | null; isActive: boolean};

export function StudentTransferForm({locale, student, groups, today}: {
  locale: Locale;
  student: StudentListItem;
  groups: GroupOption[];
  today: string;
}) {
  const t = useTranslations('students');
  const common = useTranslations('common');
  const [state, action, pending] = useActionState(moveStudentGroupAction, initialActionState);
  const label = (group: {nameEn: string; nameAr: string | null}) =>
    locale === 'ar' && group.nameAr ? group.nameAr : group.nameEn;

  return <section className="subsection">
    <h2>{t('moveGroup')}</h2>
    <p>{t('moveGroupHelp')}</p>
    <p>{t('currentGroup')}: {student.currentGroup ? label(student.currentGroup) : common('notAssigned')}</p>
    <form action={action} className="record-form">
      <input name="locale" type="hidden" value={locale} />
      <input name="studentId" type="hidden" value={student.id} />
      <div className="form-grid">
        <label>{t('targetGroup')}
          <select defaultValue="" name="groupId" required>
            <option value="">—</option>
            {groups.filter((group) => group.isActive && group.id !== student.currentGroup?.id).map((group) =>
              <option key={group.id} value={group.id}>{label(group)}</option>
            )}
          </select>
        </label>
        <label>{t('membershipStart')}<input defaultValue={today} name="startsOn" required type="date" /></label>
      </div>
      <FormFeedback state={state} />
      <div className="form-actions"><Button disabled={pending} type="submit">{pending ? common('saving') : t('moveGroup')}</Button></div>
    </form>
  </section>;
}
