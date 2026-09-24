'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import type {
  EnrollmentClassOption,
  EnrollmentClassSubject,
  StudentEnrollmentState,
  SubjectParticipation
} from '@/features/enrollment/enrollment.types';
import {
  changeStudentClassAction,
  moveStudentSubjectGroupAction,
  setSubjectExcludedAction
} from '@/features/students/student.actions';
import type {Locale} from '@/i18n/config';
import {initialActionState} from '@/lib/validation/action-state';

function SubjectEnrollmentRow({
  locale,
  studentId,
  subject,
  participation,
  today
}: {
  locale: Locale;
  studentId: string;
  subject: EnrollmentClassSubject;
  participation: SubjectParticipation;
  today: string;
}) {
  const t = useTranslations('students');
  const classes = useTranslations('classes');
  const common = useTranslations('common');
  const [excludeState, excludeAction, excludePending] = useActionState(
    setSubjectExcludedAction,
    initialActionState
  );
  const [groupState, groupAction, groupPending] = useActionState(
    moveStudentSubjectGroupAction,
    initialActionState
  );
  const activeGroups = subject.groups.filter(({isActive}) => isActive);
  const localize = (value: {nameEn: string; nameAr: string | null}) =>
    locale === 'ar' && value.nameAr ? value.nameAr : value.nameEn;
  const currentGroup = activeGroups.find(({id}) => id === participation.subjectGroupId) ?? null;

  return <div className="record-card">
    <div>
      <strong>{localize(subject)}</strong>
      <p className="field-help">
        {!participation.included
          ? t('excluded')
          : activeGroups.length === 0
            ? classes('wholeClass')
            : currentGroup
              ? localize(currentGroup)
              : t('groupAssignmentNeeded')}
      </p>
    </div>
    <form action={excludeAction} className="inline-form">
      <input name="locale" type="hidden" value={locale} />
      <input name="studentId" type="hidden" value={studentId} />
      <input name="classSubjectId" type="hidden" value={subject.id} />
      <input name="excluded" type="hidden" value={String(participation.included)} />
      <input name="effectiveOn" type="hidden" value={today} />
      <Button disabled={excludePending} type="submit" variant="secondary">
        {participation.included ? t('excludeSubject') : t('includeSubject')}
      </Button>
      <FormFeedback state={excludeState} />
    </form>
    {participation.included && activeGroups.length > 0 ? <form action={groupAction} className="inline-form">
      <input name="locale" type="hidden" value={locale} />
      <input name="studentId" type="hidden" value={studentId} />
      <input name="classSubjectId" type="hidden" value={subject.id} />
      <label>{t('subjectGroup')}<select defaultValue={participation.subjectGroupId ?? ''} name="targetGroupId" required><option value="">{t('groupAssignmentNeeded')}</option>{activeGroups.map((group) => <option key={group.id} value={group.id}>{localize(group)}</option>)}</select></label>
      <label>{t('effectiveDate')}<input defaultValue={today} name="startsOn" required type="date" /></label>
      <Button disabled={groupPending} type="submit" variant="secondary">{groupPending ? common('saving') : t('changeGroup')}</Button>
      <FormFeedback state={groupState} />
    </form> : null}
  </div>;
}

export function StudentEnrollmentEditor({
  locale,
  studentId,
  classes,
  enrollment,
  today
}: {
  locale: Locale;
  studentId: string;
  classes: EnrollmentClassOption[];
  enrollment: StudentEnrollmentState;
  today: string;
}) {
  const t = useTranslations('students');
  const common = useTranslations('common');
  const [classState, classAction, classPending] = useActionState(
    changeStudentClassAction,
    initialActionState
  );
  const localize = (value: {nameEn: string; nameAr: string | null}) =>
    locale === 'ar' && value.nameAr ? value.nameAr : value.nameEn;
  const activeClasses = classes.filter(({isActive}) => isActive);
  const targetClasses = activeClasses.filter(({id}) => id !== enrollment.currentClass?.id);

  return <section className="record-form" aria-labelledby="student-enrollment-heading">
    <div>
      <h2 id="student-enrollment-heading">{t('enrollment')}</h2>
      <p className="field-help">{t('enrollmentHelp')}</p>
    </div>
    <div className="record-card">
      <strong>{t('currentClass')}</strong>
      <p>{enrollment.currentClass ? localize(enrollment.currentClass) : common('notAssigned')}</p>
      {enrollment.currentClass && targetClasses.length > 0 ? <form action={classAction} className="inline-form">
        <input name="locale" type="hidden" value={locale} />
        <input name="studentId" type="hidden" value={studentId} />
        <label>{t('changeClass')}<select name="targetClassId" required><option value="">—</option>{targetClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{localize(schoolClass)}</option>)}</select></label>
        <label>{t('effectiveDate')}<input defaultValue={today} name="startsOn" required type="date" /></label>
        <Button disabled={classPending} type="submit" variant="secondary">{classPending ? common('saving') : t('changeClass')}</Button>
        <FormFeedback state={classState} />
      </form> : null}
    </div>
    {enrollment.currentClass ? <div className="stack-list">
      <h3>{t('subjects')}</h3>
      {enrollment.currentClass.subjects.filter(({isActive}) => isActive).map((subject) => {
        const participation = enrollment.participation.find(({classSubjectId}) => classSubjectId === subject.id);
        return participation ? <SubjectEnrollmentRow key={subject.id} locale={locale} participation={participation} studentId={studentId} subject={subject} today={today} /> : null;
      })}
    </div> : <p className="empty-state">{t('noCurrentClass')}</p>}
  </section>;
}
