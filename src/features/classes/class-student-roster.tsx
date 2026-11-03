'use client';

import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import {SectionHeader} from '@/components/ui/section-header';
import {enrollStudentsFromClassAction} from '@/features/students/student.actions';
import type {StudentListItem} from '@/features/students/student.types';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {initialActionState} from '@/lib/validation/action-state';

export function ClassStudentRoster({
  classId, locale, students, today
}: {
  classId: string;
  locale: Locale;
  students: StudentListItem[];
  today: string;
}) {
  const t = useTranslations('classes');
  const common = useTranslations('common');
  const [state, action, pending] = useActionState(
    enrollStudentsFromClassAction, initialActionState
  );
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const localName = (student: StudentListItem) =>
    locale === 'ar' && student.firstNameAr && student.lastNameAr
      ? `${student.firstNameAr} ${student.lastNameAr}`
      : `${student.firstNameEn} ${student.lastNameEn}`;

  const enrolled = students.filter((student) => student.currentClasses.some(({id}) => id === classId));
  const candidates = students.filter((student) => !student.currentClasses.some(({id}) => id === classId));
  const matching = candidates.filter((student) => {
    const query = search.trim().toLocaleLowerCase();
    return !query ||
      localName(student).toLocaleLowerCase().includes(query) ||
      `${student.firstNameEn} ${student.lastNameEn}`.toLocaleLowerCase().includes(query);
  });
  // Enrolled students are no longer selectable. Clear successful submissions
  // even when their enrollment starts in the future and today's roster is unchanged.
  useEffect(() => {
    if (state.status === 'idle') setSelected([]);
  }, [state]);
  useEffect(() => {
    const candidateIds = new Set(candidates.map((student) => student.id));
    setSelected((current) => {
      const next = current.filter((id) => candidateIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [students, classId]);

  function toggle(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...new Set([...current, id])] : current.filter((value) => value !== id)
    );
  }

  return (
    <section className="content-section">
      <SectionHeader
        title={t('studentRoster')}
        description={t('studentRosterDescription', {count: enrolled.length})}
        actions={<Link className="button button-secondary action-link"
          href={`/students/new?classId=${classId}`}>{t('createStudentHere')}</Link>}
      />
      {enrolled.length === 0 ? <p className="empty-state">{t('noEnrolledStudents')}</p> : (
        <ul className="stack-list">
          {enrolled.map((student) => (
            <li key={student.id}>
              <Link href={`/students/${student.id}`}>{localName(student)}</Link>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="record-form">
        <h3>{t('addExistingStudents')}</h3>
        <p className="field-help">{t('multiClassHelp')}</p>
        <input name="locale" type="hidden" value={locale} />
        <input name="classId" type="hidden" value={classId} />
        {selected.map((studentId) => (
          <input key={studentId} name="studentIds" type="hidden" value={studentId} />
        ))}
        <label>
          {t('searchStudents')}
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchStudents')}
            type="search"
            value={search}
          />
        </label>
        <div className="guardian-directory-options">
          {matching.length === 0 ? <p className="field-help">{t('noEligibleStudents')}</p> :
            matching.map((student) => (
              <label className="guardian-directory-option" key={student.id}>
                <input
                  checked={selected.includes(student.id)}
                  onChange={(event) => toggle(student.id, event.target.checked)}
                  type="checkbox"
                  value={student.id}
                />
                <span className="guardian-directory-copy">
                  <strong className="record-name">{localName(student)}</strong>
                  <span className="record-meta">
                    {student.currentClasses.length
                      ? student.currentClasses.map((schoolClass) =>
                        locale === 'ar' && schoolClass.nameAr ? schoolClass.nameAr : schoolClass.nameEn
                      ).join(' · ')
                      : common('notAssigned')}
                  </span>
                </span>
              </label>
            ))}
        </div>
        <label>
          {t('enrollmentStartDate')}
          <input defaultValue={today} name="startsOn" required type="date" />
        </label>
        <FormFeedback state={state} />
        <Button disabled={pending || selected.length === 0 || selected.length > 100} type="submit">
          {pending ? common('saving') : t('enrollSelected', {count: selected.length})}
        </Button>
      </form>
    </section>
  );
}
