'use client';

import {useActionState, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import type {TeachingAssignment, TeachingClassSubject} from '@/features/teaching-assignments/teaching-assignment.types';
import {
  assignTeacherAction,
  createTeacherAction,
  endTeacherAssignmentAction,
  updateTeacherAction
} from '@/features/teachers/teacher.actions';
import type {TeacherListItem} from '@/features/teachers/teacher.types';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {initialActionState} from '@/lib/validation/action-state';

export function TeacherForm({locale, teacher}: {locale: Locale; teacher?: TeacherListItem}) {
  const t = useTranslations('teachers');
  const common = useTranslations('common');
  const language = useTranslations('language');
  const [state, action, pending] = useActionState(
    teacher ? updateTeacherAction : createTeacherAction,
    initialActionState
  );

  return <form action={action} className="record-form">
    <input name="locale" type="hidden" value={locale}/>
    {teacher ? <input name="id" type="hidden" value={teacher.id}/> : null}
    <div className="form-grid">
      <label>{t('displayName')}<input defaultValue={teacher?.displayName} name="displayName" required/></label>
      <label>{t('email')}<input autoComplete="email" defaultValue={teacher?.email ?? ''} name="email" required type="email"/></label>
      <label>{t('preferredLanguage')}<select defaultValue={teacher?.preferredLanguage ?? 'en'} name="preferredLanguage">
        <option value="en">{language('english')}</option>
        <option value="ar">{language('arabic')}</option>
      </select></label>
    </div>
    <FormFeedback state={state}/>
    <div className="form-actions">
      <Button disabled={pending}>{pending ? common('saving') : common('save')}</Button>
      <Link className="button button-secondary action-link" href="/teachers">{common('cancel')}</Link>
    </div>
  </form>;
}

const isEffective = (assignment: TeachingAssignment, date: string) =>
  assignment.startsOn <= date && (assignment.endsOn === null || assignment.endsOn >= date);

export function TeachingAssignmentEditor({
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
  const [state, action, pending] = useActionState(assignTeacherAction, initialActionState);
  const classes = useMemo(() => {
    const byId = new Map<string, {id: string; nameEn: string; nameAr: string | null}>();
    for (const subject of classSubjects) {
      const id = subject.classId ?? subject.classNameEn;
      if (!byId.has(id)) byId.set(id, {id, nameEn: subject.classNameEn, nameAr: subject.classNameAr});
    }
    return [...byId.values()];
  }, [classSubjects]);
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const subjectsForClass = classSubjects.filter((subject) => (subject.classId ?? subject.classNameEn) === classId);
  const [classSubjectId, setClassSubjectId] = useState(subjectsForClass[0]?.id ?? '');
  const selectedSubject = classSubjects.find((subject) => subject.id === classSubjectId) ?? null;
  const label = (en: string, ar: string | null) => locale === 'ar' && ar ? ar : en;
  const duplicateCoverage = assignments.some((assignment) => {
    if (!selectedSubject || assignment.classSubjectId !== selectedSubject.id || !isEffective(assignment, today)) return false;
    return true;
  });

  function changeClass(next: string) {
    setClassId(next);
    const nextSubject = classSubjects.find((subject) => (subject.classId ?? subject.classNameEn) === next);
    setClassSubjectId(nextSubject?.id ?? '');
  }

  return <section className="subsection">
    <h2>{t('assignments')}</h2>
    <p>{t('assignmentHelp')}</p>
    {classSubjects.length === 0 ? <p className="empty-state">{t('noTeachingContexts')}</p> : <form action={action} className="record-form">
      <input name="locale" type="hidden" value={locale}/>
      <input name="teacherId" type="hidden" value={teacherId}/>
      <div className="form-grid">
        <label>{t('class')}<select onChange={(event) => changeClass(event.target.value)} value={classId}>
          {classes.map((item) => <option key={item.id} value={item.id}>{label(item.nameEn, item.nameAr)}</option>)}
        </select></label>
        <label>{t('subject')}<select name="classSubjectId" onChange={(event) => setClassSubjectId(event.target.value)} value={classSubjectId}>
          {subjectsForClass.map((subject) => <option key={subject.id} value={subject.id}>{label(subject.subjectNameEn, subject.subjectNameAr)}</option>)}
        </select></label>
        <label>{t('startsOn')}<input defaultValue={today} name="startsOn" required type="date"/></label>
      </div>
      {duplicateCoverage ? <p role="status">{t('coverageExists')}</p> : null}
      <FormFeedback state={state}/>
      <div className="form-actions"><Button disabled={pending || duplicateCoverage || !classSubjectId}>{pending ? common('saving') : t('addAssignment')}</Button></div>
    </form>}

    <h3>{t('assignmentHistory')}</h3>
    {assignments.length === 0 ? <p className="empty-state">{t('noAssignments')}</p> : <div className="table-wrap"><table>
      <thead><tr><th>{t('class')}</th><th>{t('subject')}</th><th>{t('startsOn')}</th><th>{t('endsOn')}</th><th>{common('actions')}</th></tr></thead>
      <tbody>{assignments.map((assignment) => {
        const subject = classSubjects.find((item) => item.id === assignment.classSubjectId);
        const active = isEffective(assignment, today);
        return <tr key={assignment.id}>
          <td>{subject ? label(subject.classNameEn, subject.classNameAr) : common('notAssigned')}</td>
          <td>{subject ? label(subject.subjectNameEn, subject.subjectNameAr) : common('notAssigned')}</td>
          <td>{assignment.startsOn}</td>
          <td>{assignment.endsOn ?? '—'}</td>
          <td>{active ? <form action={endTeacherAssignmentAction}>
            <input name="locale" type="hidden" value={locale}/>
            <input name="teacherId" type="hidden" value={teacherId}/>
            <input name="assignmentId" type="hidden" value={assignment.id}/>
            <input name="endsOn" type="hidden" value={today}/>
            <button className="text-button" type="submit">{t('endToday')}</button>
          </form> : '—'}</td>
        </tr>;
      })}</tbody>
    </table></div>}
  </section>;
}
