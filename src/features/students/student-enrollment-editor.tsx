'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {FormFeedback} from '@/components/ui/form-feedback';
import {SectionHeader} from '@/components/ui/section-header';
import type {
  EnrollmentClassOption,
  EnrollmentClassSubject,
  StudentEnrollmentState,
  SubjectParticipation
} from '@/features/enrollment/enrollment.types';
import {
  endStudentClassEnrollmentAction,
  enrollStudentInClassAction,
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
  enrollment,
  today
}: {
  locale: Locale;
  studentId: string;
  subject: EnrollmentClassSubject;
  participation: SubjectParticipation;
  enrollment: StudentEnrollmentState;
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
  const currentMembership = enrollment.memberships.find((membership) =>
    membership.classSubjectId === subject.id &&
    membership.startsOn <= today &&
    (membership.endsOn === null || membership.endsOn >= today)
  );
  const currentExclusion = enrollment.exclusions.find((exclusion) =>
    exclusion.classSubjectId === subject.id &&
    exclusion.startsOn <= today &&
    (exclusion.endsOn === null || exclusion.endsOn >= today)
  );

  return (
    <Card>
      <SectionHeader title={localize(subject)} />
      <p>
        <Badge variant={participation.included ? 'success' : 'neutral'}>
          {participation.included ? t('included') : t('excluded')}
        </Badge>
      </p>
      <p>
        {participation.included
          ? activeGroups.length === 0
            ? classes('wholeClass')
            : currentGroup
              ? localize(currentGroup)
              : t('groupAssignmentNeeded')
          : t('excluded')}
      </p>
      {currentMembership ? <p><strong>{t('effectiveDate')}:</strong> {currentMembership.startsOn}</p> : null}
      {currentExclusion ? <p><strong>{t('effectiveDate')}:</strong> {currentExclusion.startsOn}</p> : null}

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

      {participation.included && activeGroups.length > 0 ? (
        <form action={groupAction} className="form-grid compact-form">
          <input name="locale" type="hidden" value={locale} />
          <input name="studentId" type="hidden" value={studentId} />
          <input name="classSubjectId" type="hidden" value={subject.id} />
          <label>
            {t('subjectGroup')}
            <select defaultValue={participation.subjectGroupId ?? ''} name="targetGroupId" required>
              <option value="">{t('groupAssignmentNeeded')}</option>
              {activeGroups.map((group) => <option key={group.id} value={group.id}>{localize(group)}</option>)}
            </select>
          </label>
          <label>
            {t('effectiveDate')}
            <input defaultValue={today} name="startsOn" required type="date" />
          </label>
          <Button disabled={groupPending} type="submit" variant="secondary">
            {groupPending ? common('saving') : t('changeGroup')}
          </Button>
          <FormFeedback state={groupState} />
        </form>
      ) : null}
    </Card>
  );
}

function EnrollmentClassSection({
  enrollment,
  locale,
  studentId,
  today
}: {
  enrollment: StudentEnrollmentState;
  locale: Locale;
  studentId: string;
  today: string;
}) {
  const t = useTranslations('students');
  const common = useTranslations('common');
  const [endState, endAction, endPending] = useActionState(
    endStudentClassEnrollmentAction,
    initialActionState
  );
  const localize = (item: {nameEn: string; nameAr: string | null}) =>
    locale === 'ar' && item.nameAr ? item.nameAr : item.nameEn;
  return (
    <div className="stack-list">
      {enrollment.currentEnrollments.map(({schoolClass, enrollment: dated, participation}) => (
        <Card key={schoolClass.id}>
          <SectionHeader title={localize(schoolClass)} />
          <p><strong>{t('enrollmentStart')}:</strong> {dated.startsOn}</p>
          <div className="form-grid">
            {schoolClass.subjects.filter(({isActive}) => isActive).map((subject) => {
              const entry = participation.find(({classSubjectId}) => classSubjectId === subject.id);
              return entry ? (
                <SubjectEnrollmentRow
                  enrollment={enrollment}
                  key={subject.id}
                  locale={locale}
                  participation={entry}
                  studentId={studentId}
                  subject={subject}
                  today={today}
                />
              ) : null;
            })}
          </div>
          <form action={endAction} className="form-grid compact-form">
            <input name="locale" type="hidden" value={locale} />
            <input name="studentId" type="hidden" value={studentId} />
            <input name="classId" type="hidden" value={schoolClass.id} />
            <label>
              {t('endClassEnrollment')}
              <input name="endsOn" type="date" defaultValue={today} min={dated.startsOn} required />
            </label>
            <Button disabled={endPending} variant="secondary" type="submit">
              {endPending ? common('saving') : t('endClassEnrollment')}
            </Button>
            <FormFeedback state={endState} />
          </form>
        </Card>
      ))}
    </div>
  );
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
    enrollStudentInClassAction, initialActionState
  );
  const localize = (item: {nameEn: string; nameAr: string | null}) =>
    locale === 'ar' && item.nameAr ? item.nameAr : item.nameEn;
  const enrolledClassIds = new Set(enrollment.currentEnrollments.map(({schoolClass}) => schoolClass.id));
  const targetClasses = classes.filter(({isActive, id}) => isActive && !enrolledClassIds.has(id));

  return (
    <section aria-labelledby="student-enrollment-heading" className="stack-list">
      <Card>
        <SectionHeader title={t('addAnotherClass')} />
        <p className="field-help">{t('multiClassHelp')}</p>
        {targetClasses.length ? (
          <form action={classAction} className="form-grid compact-form">
            <input name="locale" type="hidden" value={locale} />
            <input name="studentId" type="hidden" value={studentId} />
            <label>
              {t('class')}
              <select name="targetClassId" required defaultValue="">
                <option value="">—</option>
                {targetClasses.map((schoolClass) =>
                  <option key={schoolClass.id} value={schoolClass.id}>{localize(schoolClass)}</option>
                )}
              </select>
            </label>
            <label>
              {t('effectiveDate')}
              <input defaultValue={today} name="startsOn" required type="date" />
            </label>
            <Button disabled={classPending} type="submit">
              {classPending ? common('saving') : t('enrollInClass')}
            </Button>
            <FormFeedback state={classState} />
          </form>
        ) : <p className="field-help">{t('allClassesEnrolled')}</p>}
      </Card>
      <h2 id="student-enrollment-heading">{t('currentClasses')}</h2>
      {enrollment.currentEnrollments.length
        ? <EnrollmentClassSection enrollment={enrollment} locale={locale} studentId={studentId} today={today} />
        : <p className="empty-state">{t('noCurrentClass')}</p>}
    </section>
  );
}
