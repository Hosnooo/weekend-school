'use client';

import {useActionState, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {
  createTeachingAssignmentAction,
  updateTeachingAssignmentAction
} from '@/features/teaching-assignments/teaching-assignment.actions';
import {classifyTeachingAssignments} from '@/features/teaching-assignments/teaching-assignment.service';
import type {
  TeachingAssignment,
  TeachingClassSubject
} from '@/features/teaching-assignments/teaching-assignment.types';
import type {Locale} from '@/i18n/config';
import {initialActionState} from '@/lib/validation/action-state';

type AssignmentLabels = {
  current: string;
  upcoming: string;
  past: string;
  saveDates: string;
  endToday: string;
  add: string;
  empty: string;
  historyNote: string;
};

type AssignmentSectionProps = {
  title: string;
  items: TeachingAssignment[];
  allowEnd?: boolean;
  locale: Locale;
  teacherId: string;
  classSubjects: TeachingClassSubject[];
  today: string;
  labels: AssignmentLabels;
  notAssigned: string;
  entireSubject: string;
  startsOn: string;
  endsOn: string;
};

function AssignmentSection({
  title,
  items,
  allowEnd = false,
  locale,
  teacherId,
  classSubjects,
  today,
  labels,
  notAssigned,
  entireSubject,
  startsOn,
  endsOn
}: AssignmentSectionProps) {
  const localName = (en: string, ar: string | null) => locale === 'ar' && ar ? ar : en;

  return (
    <section className="subsection">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="empty-state">{labels.empty}</p>
      ) : (
        <div className="record-list">
          {items.map((assignment) => {
            const subject = classSubjects.find((item) => item.id === assignment.classSubjectId);
            const group = subject?.groups.find((item) => item.id === assignment.subjectGroupId) ?? null;

            return (
              <article className="record-card" key={assignment.id}>
                <div>
                  <strong>
                    {subject ? localName(subject.classNameEn, subject.classNameAr) : notAssigned}
                    {' · '}
                    {subject ? localName(subject.subjectNameEn, subject.subjectNameAr) : notAssigned}
                  </strong>
                  <p>
                    {assignment.subjectGroupId === null
                      ? entireSubject
                      : group
                        ? localName(group.nameEn, group.nameAr)
                        : notAssigned}
                  </p>
                </div>

                <form action={updateTeachingAssignmentAction} className="form-grid compact-form">
                  <input name="locale" type="hidden" value={locale} />
                  <input name="teacherId" type="hidden" value={teacherId} />
                  <input name="assignmentId" type="hidden" value={assignment.id} />
                  <label>
                    {startsOn}
                    <input defaultValue={assignment.startsOn} name="startsOn" required type="date" />
                  </label>
                  <label>
                    {endsOn}
                    <input
                      defaultValue={assignment.endsOn ?? ''}
                      min={assignment.startsOn}
                      name="endsOn"
                      type="date"
                    />
                  </label>
                  <div className="form-actions">
                    <Button type="submit" variant="secondary">{labels.saveDates}</Button>
                  </div>
                </form>

                {allowEnd ? (
                  <form action={updateTeachingAssignmentAction}>
                    <input name="locale" type="hidden" value={locale} />
                    <input name="teacherId" type="hidden" value={teacherId} />
                    <input name="assignmentId" type="hidden" value={assignment.id} />
                    <input name="startsOn" type="hidden" value={assignment.startsOn} />
                    <input name="endsOn" type="hidden" value={today} />
                    <button className="text-button" type="submit">{labels.endToday}</button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function TeachingAssignmentWorkspace({
  locale,
  teacherId,
  classSubjects,
  assignments,
  today
}: {
  locale: Locale;
  teacherId: string;
  classSubjects: TeachingClassSubject[];
  assignments: TeachingAssignment[];
  today: string;
}) {
  const t = useTranslations('teachers');
  const common = useTranslations('common');
  const [state, createAction, pending] = useActionState(
    createTeachingAssignmentAction,
    initialActionState
  );
  const classes = useMemo(() => {
    const map = new Map<string, {id: string; nameEn: string; nameAr: string | null}>();
    for (const item of classSubjects) {
      const id = item.classId ?? item.classNameEn;
      if (!map.has(id)) map.set(id, {id, nameEn: item.classNameEn, nameAr: item.classNameAr});
    }
    return [...map.values()];
  }, [classSubjects]);
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const firstSubject = classSubjects.find(
    (item) => (item.classId ?? item.classNameEn) === classId
  )?.id ?? '';
  const [classSubjectId, setClassSubjectId] = useState(firstSubject);
  const [subjectGroupId, setSubjectGroupId] = useState('');
  const subjectsForClass = classSubjects.filter(
    (item) => (item.classId ?? item.classNameEn) === classId
  );
  const selectedSubject = classSubjects.find((item) => item.id === classSubjectId)
    ?? subjectsForClass[0]
    ?? null;
  const {
    current: currentAssignments,
    upcoming: upcomingAssignments,
    past: pastAssignments
  } = classifyTeachingAssignments(assignments, today);
  const localName = (en: string, ar: string | null) => locale === 'ar' && ar ? ar : en;
  const labels: AssignmentLabels = locale === 'ar'
    ? {
        current: 'الحالية',
        upcoming: 'القادمة',
        past: 'السابقة',
        saveDates: 'حفظ التواريخ',
        endToday: 'إنهاء اليوم',
        add: 'إضافة تعيين',
        empty: 'لا توجد تعيينات في هذا القسم.',
        historyNote: 'يمكن تعديل التواريخ ما دامت لا تُبطل سجل تدريس تم تسليمه.'
      }
    : {
        current: 'Current',
        upcoming: 'Upcoming',
        past: 'Past',
        saveDates: 'Save dates',
        endToday: 'End today',
        add: 'Add assignment',
        empty: 'No assignments in this section.',
        historyNote: 'Dates can be changed only when protected submitted teaching history remains valid.'
      };

  function chooseClass(next: string) {
    setClassId(next);
    const nextSubject = classSubjects.find(
      (item) => (item.classId ?? item.classNameEn) === next
    )?.id ?? '';
    setClassSubjectId(nextSubject);
    setSubjectGroupId('');
  }

  const sectionProps = {
    locale,
    teacherId,
    classSubjects,
    today,
    labels,
    notAssigned: common('notAssigned'),
    entireSubject: t('entireSubject'),
    startsOn: t('startsOn'),
    endsOn: t('endsOn')
  };

  return (
    <div className="assignment-workspace">
      <section className="subsection">
        <h2>{labels.add}</h2>
        <p>{t('assignmentHelp')}</p>
        <p className="form-hint">{labels.historyNote}</p>
        {classSubjects.length === 0 ? (
          <p className="empty-state">{t('noTeachingContexts')}</p>
        ) : (
          <form action={createAction} className="record-form">
            <input name="locale" type="hidden" value={locale} />
            <input name="teacherId" type="hidden" value={teacherId} />
            <div className="form-grid">
              <label>
                {t('class')}
                <select onChange={(event) => chooseClass(event.target.value)} value={classId}>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>{localName(item.nameEn, item.nameAr)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('subject')}
                <select
                  name="classSubjectId"
                  onChange={(event) => {
                    setClassSubjectId(event.target.value);
                    setSubjectGroupId('');
                  }}
                  value={selectedSubject?.id ?? ''}
                >
                  {subjectsForClass.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {localName(subject.subjectNameEn, subject.subjectNameAr)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('scope')}
                <select
                  name="subjectGroupId"
                  onChange={(event) => setSubjectGroupId(event.target.value)}
                  value={subjectGroupId}
                >
                  <option value="">{t('entireSubject')}</option>
                  {selectedSubject?.groups.map((group) => (
                    <option key={group.id} value={group.id}>{localName(group.nameEn, group.nameAr)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('startsOn')}
                <input defaultValue={today} name="startsOn" required type="date" />
              </label>
            </div>
            <FormFeedback state={state} />
            <div className="form-actions">
              <Button disabled={pending || !selectedSubject}>
                {pending ? common('saving') : t('addAssignment')}
              </Button>
            </div>
          </form>
        )}
      </section>

      <AssignmentSection {...sectionProps} allowEnd items={currentAssignments} title={labels.current} />
      <AssignmentSection {...sectionProps} items={upcomingAssignments} title={labels.upcoming} />
      <AssignmentSection {...sectionProps} items={pastAssignments} title={labels.past} />
    </div>
  );
}
