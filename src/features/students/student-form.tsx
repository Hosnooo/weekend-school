'use client';

import {useActionState, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {FormFeedback} from '@/components/ui/form-feedback';
import type {EnrollmentClassOption} from '@/features/enrollment/enrollment.types';
import type {GuardianListItem} from '@/features/guardians/guardian.types';
import {
  createStudentAction,
  updateStudentAction
} from '@/features/students/student.actions';
import type {StudentListItem} from '@/features/students/student.types';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';
import {initialActionState} from '@/lib/validation/action-state';

type SubjectSelection = {
  classSubjectId: string;
  included: boolean;
  groupId: string | null;
};

export function StudentForm({
  locale,
  classes = [],
  availableGuardians = [],
  student,
  today,
  cancelHref = '/students'
}: {
  locale: Locale;
  classes?: EnrollmentClassOption[];
  availableGuardians?: GuardianListItem[];
  student?: StudentListItem;
  today?: string;
  cancelHref?: string;
}) {
  const t = useTranslations('students');
  const common = useTranslations('common');
  const classMessages = useTranslations('classes');
  const guardiansT = useTranslations('guardians');
  const reportLanguages = useTranslations('reportLanguages');
  const [state, action, pending] = useActionState(
    student ? updateStudentAction : createStudentAction,
    initialActionState
  );
  const activeClasses = useMemo(
    () => classes.filter(({isActive}) => isActive),
    [classes]
  );
  const [classId, setClassId] = useState('');
  const selectedClass =
    activeClasses.find(({id}) => id === classId) ?? null;
  const [selections, setSelections] = useState<SubjectSelection[]>([]);
  const [guardianMode, setGuardianMode] = useState<
    'none' | 'existing' | 'new'
  >('none');
  const [guardianId, setGuardianId] = useState('');
  const [guardianSearch, setGuardianSearch] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');

  const normalizedGuardianSearch = guardianSearch.trim().toLocaleLowerCase();
  const matchingGuardians = availableGuardians.filter((guardian) => {
    if (!normalizedGuardianSearch) return true;
    return (
      guardian.name.toLocaleLowerCase().includes(normalizedGuardianSearch) ||
      guardian.email.toLocaleLowerCase().includes(normalizedGuardianSearch)
    );
  });

  const normalizedGuardianEmail = guardianEmail.trim().toLocaleLowerCase();
  const existingGuardianForEmail =
    guardianMode === 'new' && normalizedGuardianEmail
      ? availableGuardians.find(
          (guardian) =>
            guardian.email.toLocaleLowerCase() === normalizedGuardianEmail
        ) ?? null
      : null;

  const localize = (value: {nameEn: string; nameAr: string | null}) =>
    locale === 'ar' && value.nameAr ? value.nameAr : value.nameEn;

  const selectClass = (nextClassId: string) => {
    setClassId(nextClassId);
    const nextClass = activeClasses.find(({id}) => id === nextClassId);
    setSelections(
      (nextClass?.subjects ?? [])
        .filter(({isActive}) => isActive)
        .map((subject) => ({
          classSubjectId: subject.id,
          included: true,
          groupId: subject.groups.some(
            ({id, isActive}) => isActive && id === subject.defaultGroupId
          )
            ? subject.defaultGroupId
            : null
        }))
    );
  };

  const updateSelection = (
    classSubjectId: string,
    patch: Partial<SubjectSelection>
  ) => {
    setSelections((current) =>
      current.map((selection) =>
        selection.classSubjectId === classSubjectId
          ? {...selection, ...patch}
          : selection
      )
    );
  };

  return (
    <form action={action} className="record-form">
      <input name="locale" type="hidden" value={locale} />
      {student ? <input name="id" type="hidden" value={student.id} /> : null}

      <div className="form-grid">
        <label>
          {t('firstNameEn')}
          <input defaultValue={student?.firstNameEn} name="firstNameEn" required />
        </label>
        <label>
          {t('lastNameEn')}
          <input defaultValue={student?.lastNameEn} name="lastNameEn" required />
        </label>
        <label>
          {t('firstNameAr')}
          <input
            defaultValue={student?.firstNameAr ?? ''}
            dir="rtl"
            name="firstNameAr"
          />
        </label>
        <label>
          {t('lastNameAr')}
          <input
            defaultValue={student?.lastNameAr ?? ''}
            dir="rtl"
            name="lastNameAr"
          />
        </label>
      </div>

      {!student ? (
        <>
          <fieldset>
            <legend>{t('guardianOptional')}</legend>
            <p className="field-help">
              {guardiansT('guardianChoiceHelp')}
            </p>

            <input
              name="guardianMode"
              type="hidden"
              value={guardianMode}
            />
            <input
              name="guardianId"
              type="hidden"
              value={guardianMode === 'existing' ? guardianId : ''}
            />

            <div className="guardian-mode-options">
              <label className="guardian-mode-option">
                <input
                  checked={guardianMode === 'none'}
                  name="guardianModeChoice"
                  onChange={() => {
                    setGuardianMode('none');
                    setGuardianId('');
                  }}
                  type="radio"
                />{' '}
                {guardiansT('noGuardian')}
              </label>

              <label className="guardian-mode-option">
                <input
                  checked={guardianMode === 'existing'}
                  disabled={availableGuardians.length === 0}
                  name="guardianModeChoice"
                  onChange={() => setGuardianMode('existing')}
                  type="radio"
                />{' '}
                {guardiansT('linkExistingGuardian')}
              </label>

              <label className="guardian-mode-option">
                <input
                  checked={guardianMode === 'new'}
                  name="guardianModeChoice"
                  onChange={() => {
                    setGuardianMode('new');
                    setGuardianId('');
                  }}
                  type="radio"
                />{' '}
                {guardiansT('addNewGuardian')}
              </label>
            </div>

            {guardianMode === 'existing' ? (
              <div className="stack-list">
                <label>
                  {guardiansT('searchExistingGuardian')}
                  <input
                    name="guardianSearch"
                    onChange={(event) =>
                      setGuardianSearch(event.target.value)
                    }
                    placeholder={guardiansT(
                      'searchExistingGuardianPlaceholder'
                    )}
                    type="search"
                    value={guardianSearch}
                  />
                </label>

                <p className="field-help">
                  {guardiansT('searchExistingGuardianHelp')}
                </p>

                {matchingGuardians.length === 0 ? (
                  <p>{guardiansT('noGuardianSearchResults')}</p>
                ) : (
                  <div className="guardian-directory-options">
                    {matchingGuardians.map((guardian) => (
                      <label
                        className="guardian-directory-option"
                        key={guardian.id}
                      >
                        <input
                          checked={guardianId === guardian.id}
                          name="guardianSelection"
                          onChange={() => setGuardianId(guardian.id)}
                          type="radio"
                        />
                        <span className="guardian-directory-copy">
                          <strong className="record-name">{guardian.name}</strong>
                          <span className="record-meta">
                            {guardian.email}
                            {!guardian.isActive
                              ? ` · ${guardiansT('archived')}`
                              : ''}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {guardianId &&
                availableGuardians.find(
                  (guardian) =>
                    guardian.id === guardianId && !guardian.isActive
                ) ? (
                  <p className="field-help">
                    {guardiansT('selectedArchivedGuardianHelp')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {guardianMode === 'new' ? (
              <div className="stack-list">
                <div className="form-grid">
                  <label>
                    {t('guardianName')}
                    <input name="guardianName" required />
                  </label>

                  <label>
                    {t('guardianEmail')}
                    <input
                      autoComplete="email"
                      name="guardianEmail"
                      onChange={(event) =>
                        setGuardianEmail(event.target.value)
                      }
                      required
                      type="email"
                      value={guardianEmail}
                    />
                  </label>

                  <label>
                    {t('guardianPhone')}
                    <input
                      autoComplete="tel"
                      name="guardianPhone"
                      required
                      type="tel"
                    />
                  </label>

                  <label>
                    {t('reportLanguage')}
                    <select defaultValue="en" name="reportLanguage">
                      <option value="en">{reportLanguages('en')}</option>
                      <option value="ar">{reportLanguages('ar')}</option>
                      <option value="both">
                        {reportLanguages('both')}
                      </option>
                    </select>
                  </label>
                </div>

                {existingGuardianForEmail ? (
                  <div className="record-card stack-list">
                    <p>
                      {guardiansT('existingEmailFound')}
                    </p>
                    <div className="guardian-directory-copy">
                      <strong className="record-name">
                        {existingGuardianForEmail.name}
                      </strong>
                      <span className="record-meta">
                        {existingGuardianForEmail.email}
                        {!existingGuardianForEmail.isActive
                          ? ` · ${guardiansT('archived')}`
                          : ''}
                      </span>
                    </div>
                    <Button
                      onClick={() => {
                        setGuardianMode('existing');
                        setGuardianId(existingGuardianForEmail.id);
                        setGuardianSearch(existingGuardianForEmail.email);
                      }}
                      type="button"
                      variant="secondary"
                    >
                      {guardiansT('useExistingGuardian')}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </fieldset>

          <fieldset>
            <legend>{t('enrollment')}</legend>
            <div className="form-grid">
              <label>
                {t('class')}
                <select
                  name="classId"
                  onChange={(event) => selectClass(event.target.value)}
                  required
                  value={classId}
                >
                  <option value="">—</option>
                  {activeClasses.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {localize(schoolClass)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('enrollmentStart')}
                <input
                  defaultValue={today ?? ''}
                  name="startsOn"
                  required
                  type="date"
                />
              </label>
            </div>

            <input
              name="subjects"
              type="hidden"
              value={JSON.stringify(selections)}
            />

            {selectedClass ? (
              <div className="stack-list">
                <p className="field-help">{t('subjectsHelp')}</p>
                {selectedClass.subjects
                  .filter(({isActive}) => isActive)
                  .map((subject) => {
                    const selection = selections.find(
                      ({classSubjectId}) => classSubjectId === subject.id
                    );
                    if (!selection) return null;

                    const activeGroups =
                      subject.groups.filter(({isActive}) => isActive);

                    return (
                      <div className="record-card" key={subject.id}>
                        <div><strong>{localize(subject)}</strong></div>
                        <label>
                          <input
                            checked={selection.included}
                            onChange={(event) =>
                              updateSelection(subject.id, {
                                included: event.target.checked,
                                groupId: event.target.checked
                                  ? selection.groupId
                                  : null
                              })
                            }
                            type="checkbox"
                          />{' '}
                          {selection.included
                            ? t('included')
                            : t('excluded')}
                        </label>

                        {selection.included ? (
                          activeGroups.length === 0 ? (
                            <p className="field-help">
                              {classMessages('wholeClass')}
                            </p>
                          ) : (
                            <label>
                              {t('subjectGroup')}
                              <select
                                onChange={(event) =>
                                  updateSelection(subject.id, {
                                    groupId: event.target.value || null
                                  })
                                }
                                required
                                value={selection.groupId ?? ''}
                              >
                                <option value="">
                                  {t('groupAssignmentNeeded')}
                                </option>
                                {activeGroups.map((group) => (
                                  <option key={group.id} value={group.id}>
                                    {localize(group)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            ) : null}
          </fieldset>
        </>
      ) : null}

      <FormFeedback state={state} />

      <div className="form-actions">
        <Button
          disabled={pending || Boolean(existingGuardianForEmail)}
          type="submit"
        >
          {pending ? common('saving') : common('save')}
        </Button>
        <Link
          className="button button-secondary action-link"
          href={cancelHref}
        >
          {common('cancel')}
        </Link>
      </div>
    </form>
  );
}
