'use client';

import {useActionState, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import type {EnrollmentClassOption} from '@/features/enrollment/enrollment.types';
import {createStudentAction, updateStudentAction} from '@/features/students/student.actions';
import type {StudentListItem} from '@/features/students/student.types';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {initialActionState} from '@/lib/validation/action-state';

type SubjectSelection = {
  classSubjectId: string;
  included: boolean;
  groupId: string | null;
};

export function StudentForm({locale, classes = [], student, today, cancelHref = '/students'}: {
  locale: Locale;
  classes?: EnrollmentClassOption[];
  student?: StudentListItem;
  today?: string;
  cancelHref?: string;
}) {
  const t = useTranslations('students');
  const common = useTranslations('common');
  const classMessages = useTranslations('classes');
  const reportLanguages = useTranslations('reportLanguages');
  const [state, action, pending] = useActionState(
    student ? updateStudentAction : createStudentAction,
    initialActionState
  );
  const activeClasses = useMemo(() => classes.filter(({isActive}) => isActive), [classes]);
  const [classId, setClassId] = useState('');
  const selectedClass = activeClasses.find(({id}) => id === classId) ?? null;
  const [selections, setSelections] = useState<SubjectSelection[]>([]);

  const localize = (value: {nameEn: string; nameAr: string | null}) =>
    locale === 'ar' && value.nameAr ? value.nameAr : value.nameEn;

  const selectClass = (nextClassId: string) => {
    setClassId(nextClassId);
    const nextClass = activeClasses.find(({id}) => id === nextClassId);
    setSelections((nextClass?.subjects ?? [])
      .filter(({isActive}) => isActive)
      .map((subject) => ({
        classSubjectId: subject.id,
        included: true,
        groupId: subject.groups.some(({id, isActive}) => isActive && id === subject.defaultGroupId)
          ? subject.defaultGroupId
          : null
      })));
  };

  const updateSelection = (classSubjectId: string, patch: Partial<SubjectSelection>) => {
    setSelections((current) => current.map((selection) =>
      selection.classSubjectId === classSubjectId ? {...selection, ...patch} : selection
    ));
  };

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
          <label>{t('reportLanguage')}<select defaultValue="en" name="reportLanguage"><option value="en">{reportLanguages('en')}</option><option value="ar">{reportLanguages('ar')}</option><option value="both">{reportLanguages('both')}</option></select></label>
        </div></fieldset>
        <fieldset>
          <legend>{t('enrollment')}</legend>
          <div className="form-grid">
            <label>{t('class')}<select name="classId" onChange={(event) => selectClass(event.target.value)} required value={classId}><option value="">—</option>{activeClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{localize(schoolClass)}</option>)}</select></label>
            <label>{t('enrollmentStart')}<input defaultValue={today ?? ''} name="startsOn" required type="date" /></label>
          </div>
          <input name="subjects" type="hidden" value={JSON.stringify(selections)} />
          {selectedClass ? <div className="stack-list">
            <p className="field-help">{t('subjectsHelp')}</p>
            {selectedClass.subjects.filter(({isActive}) => isActive).map((subject) => {
              const selection = selections.find(({classSubjectId}) => classSubjectId === subject.id);
              if (!selection) return null;
              const activeGroups = subject.groups.filter(({isActive}) => isActive);
              return <div className="record-card" key={subject.id}>
                <div><strong>{localize(subject)}</strong></div>
                <label><input checked={selection.included} onChange={(event) => updateSelection(subject.id, {included: event.target.checked, groupId: event.target.checked ? selection.groupId : null})} type="checkbox" /> {selection.included ? t('included') : t('excluded')}</label>
                {selection.included ? activeGroups.length === 0
                  ? <p className="field-help">{classMessages('wholeClass')}</p>
                  : <label>{t('subjectGroup')}<select onChange={(event) => updateSelection(subject.id, {groupId: event.target.value || null})} required value={selection.groupId ?? ''}><option value="">{t('groupAssignmentNeeded')}</option>{activeGroups.map((group) => <option key={group.id} value={group.id}>{localize(group)}</option>)}</select></label>
                  : null}
              </div>;
            })}
          </div> : null}
        </fieldset>
      </> : null}
      <FormFeedback state={state} />
      <div className="form-actions"><Button disabled={pending} type="submit">{pending ? common('saving') : common('save')}</Button><Link className="button button-secondary action-link" href={cancelHref}>{common('cancel')}</Link></div>
    </form>
  );
}
