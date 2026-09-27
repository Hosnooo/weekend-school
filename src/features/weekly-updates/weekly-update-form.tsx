'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState
} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';

import {
  markAllPresent,
  toSparseExceptions
} from './weekly-update.model';
import type {
  AttendanceStatus,
  Performance,
  StudentException
} from './weekly-update.model';
import {saveWeeklyUpdateAction} from './weekly-update.actions';
import type {WeeklyActionState} from './weekly-update.actions';
import type {WeeklySubmission} from './weekly-update.types';

const initialWeeklyActionState: WeeklyActionState = {
  status: 'idle',
  error: null
};

export function WeeklyUpdateForm({
  locale,
  submission,
  readOnly = false
}: {
  locale: 'en' | 'ar';
  submission: WeeklySubmission;
  readOnly?: boolean;
}) {
  const t = useTranslations('weekly');
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);

  const [state, action, pending] = useActionState(
    saveWeeklyUpdateAction,
    initialWeeklyActionState
  );

  const [dirty, setDirty] = useState(false);
  const [changeRevision, setChangeRevision] = useState(0);

  const [attendance, setAttendance] = useState(() =>
    submission.roster.map(
      (student) =>
        submission.attendance.find(
          (item) => item.studentId === student.id
        ) ?? {
          studentId: student.id,
          status: '' as AttendanceStatus | ''
        }
    )
  );

  const [exceptions, setExceptions] = useState<StudentException[]>(() =>
    submission.roster.map(
      (student) =>
        submission.exceptions.find(
          (item) => item.studentId === student.id
        ) ?? {
          studentId: student.id,
          performanceOverride: null,
          commentEn: null,
          commentAr: null
        }
    )
  );

  const change = () => {
    setDirty(true);
    setChangeRevision((revision) => revision + 1);
  };

  useEffect(() => {
    if (state.status === 'saved' || state.status === 'error') {
      submittingRef.current = false;
    }

    if (state.status !== 'saved') return;

    const timer = setTimeout(() => setDirty(false), 0);
    return () => clearTimeout(timer);
  }, [state.status]);

  useEffect(() => {
    if (readOnly || !dirty) return;

    const timer = setTimeout(() => {
      if (!formRef.current || submittingRef.current) return;

      const data = new FormData(formRef.current);
      data.set('intent', 'draft');

      startTransition(() => action(data));
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    attendance,
    exceptions,
    dirty,
    changeRevision,
    readOnly,
    action
  ]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setStatus = (
    studentId: string,
    status: AttendanceStatus
  ) => {
    setAttendance((items) =>
      items.map((item) =>
        item.studentId === studentId
          ? {...item, status}
          : item
      )
    );

    change();
  };

  const setException = (
    studentId: string,
    patch: Partial<StudentException>
  ) => {
    setExceptions((items) =>
      items.map((item) =>
        item.studentId === studentId
          ? {...item, ...patch}
          : item
      )
    );

    change();
  };

  const name = (id: string) => {
    const student = submission.roster.find(
      (item) => item.id === id
    )!;

    return locale === 'ar' && student.nameAr
      ? student.nameAr
      : student.nameEn;
  };

  return (
    <form
      action={action}
      className="weekly-form"
      onChange={change}
      onSubmit={() => {
        submittingRef.current = true;
      }}
      ref={formRef}
    >
      <input name="locale" type="hidden" value={locale} />
      <input
        name="teacherId"
        type="hidden"
        value={submission.teacherId}
      />
      <input
        name="submissionId"
        type="hidden"
        value={submission.id}
      />
      <input
        name="classSubjectId"
        type="hidden"
        value={submission.classSubjectId}
      />
      <input
        name="subjectGroupId"
        type="hidden"
        value={submission.subjectGroupId ?? ''}
      />
      <input
        name="weekStart"
        type="hidden"
        value={submission.weekStart}
      />
      <input
        name="attendance"
        type="hidden"
        value={JSON.stringify(
          attendance.filter(({status}) => status)
        )}
      />
      <input
        name="exceptions"
        type="hidden"
        value={JSON.stringify(toSparseExceptions(exceptions))}
      />

      <Card className="subsection">
        <h2>{t('groupProgress')}</h2>

        <label>
          {t('progressEn')}
          <textarea
            defaultValue={submission.progressEn ?? ''}
            disabled={readOnly}
            name="progressEn"
            rows={4}
          />
        </label>

        <label>
          {t('progressAr')}
          <textarea
            defaultValue={submission.progressAr ?? ''}
            dir="rtl"
            disabled={readOnly}
            name="progressAr"
            rows={4}
          />
        </label>
      </Card>

      <Card className="subsection">
        <h2>{t('defaultPerformance')}</h2>

        <select
          aria-label={t('defaultPerformance')}
          defaultValue={submission.defaultPerformance ?? ''}
          disabled={readOnly}
          name="defaultPerformance"
        >
          <option value="">—</option>

          {(
            [
              'EXCELLENT',
              'GOOD',
              'DEVELOPING',
              'NEEDS_SUPPORT'
            ] as Performance[]
          ).map((value) => (
            <option key={value} value={value}>
              {t(`performance.${value}`)}
            </option>
          ))}
        </select>
      </Card>

      <Card className="subsection">
        <div className="section-heading">
          <div>
            <h2>{t('students')}</h2>
            <p className="field-help">{t('studentsHelp')}</p>
          </div>

          {!readOnly && submission.roster.length > 0 ? (
            <Button
              onClick={() => {
                setAttendance(
                  markAllPresent(
                    submission.roster.map(({id}) => id)
                  )
                );
                change();
              }}
              type="button"
              variant="secondary"
            >
              {t('markAllPresent')}
            </Button>
          ) : null}
        </div>

        {submission.roster.length === 0 ? (
          <p className="empty-state">{t('noStudentsForWeek')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('student')}</th>
                  <th>{t('attendance')}</th>
                  <th>{t('performanceOverride')}</th>
                  <th>{t('commentEn')}</th>
                  <th>{t('commentAr')}</th>
                </tr>
              </thead>

              <tbody>
                {submission.roster.map((student) => {
                  const attendanceItem = attendance.find(
                    ({studentId}) => studentId === student.id
                  )!;
                  const exceptionItem = exceptions.find(
                    ({studentId}) => studentId === student.id
                  )!;
                  const studentName = name(student.id);

                  return (
                    <tr key={student.id}>
                      <td>
                        <strong>{studentName}</strong>
                      </td>

                      <td>
                        <select
                          aria-label={`${t('attendance')} — ${studentName}`}
                          disabled={readOnly}
                          onChange={(event) =>
                            setStatus(
                              student.id,
                              event.target.value as AttendanceStatus
                            )
                          }
                          required
                          value={attendanceItem.status}
                        >
                          <option value="">—</option>
                          {(['PRESENT', 'ABSENT'] as const).map(
                            (status) => (
                              <option key={status} value={status}>
                                {t(`attendanceStatus.${status}`)}
                              </option>
                            )
                          )}
                        </select>
                      </td>

                      <td>
                        <select
                          aria-label={`${t('performanceOverride')} — ${studentName}`}
                          disabled={readOnly}
                          onChange={(event) =>
                            setException(student.id, {
                              performanceOverride: (
                                event.target.value || null
                              ) as Performance | null
                            })
                          }
                          value={exceptionItem.performanceOverride ?? ''}
                        >
                          <option value="">{t('useDefault')}</option>
                          {(
                            [
                              'EXCELLENT',
                              'GOOD',
                              'DEVELOPING',
                              'NEEDS_SUPPORT'
                            ] as Performance[]
                          ).map((value) => (
                            <option key={value} value={value}>
                              {t(`performance.${value}`)}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <textarea
                          aria-label={`${t('commentEn')} — ${studentName}`}
                          disabled={readOnly}
                          onChange={(event) =>
                            setException(student.id, {
                              commentEn: event.target.value
                            })
                          }
                          rows={2}
                          value={exceptionItem.commentEn ?? ''}
                        />
                      </td>

                      <td>
                        <textarea
                          aria-label={`${t('commentAr')} — ${studentName}`}
                          dir="rtl"
                          disabled={readOnly}
                          onChange={(event) =>
                            setException(student.id, {
                              commentAr: event.target.value
                            })
                          }
                          rows={2}
                          value={exceptionItem.commentAr ?? ''}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!readOnly ? (
        <div className="sticky-actions">
          <span
            aria-live="polite"
            className={state.error ? 'form-error' : 'save-status'}
          >
            {pending
              ? t('saving')
              : state.error
                ? t(state.error)
                : dirty
                  ? t('unsaved')
                  : t('saved')}
          </span>

          <div className="form-actions">
            <Button
              disabled={pending}
              name="intent"
              type="submit"
              value="draft"
            >
              {t('saveDraft')}
            </Button>

            <Button
              disabled={pending}
              name="intent"
              type="submit"
              value="submit"
              variant="secondary"
            >
              {t('submit')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="status-badge status-active">
          {t('submitted')}
        </p>
      )}
    </form>
  );
}
