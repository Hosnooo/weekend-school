'use client';

import {
  useActionState,
  useEffect,
  useMemo,
  useState
} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {formatValidationIssue} from '@/lib/validation/error-guidance';
import {Alert} from '@/components/ui/alert';
import type {ReportTemplateConfig} from '@/features/reports/report-template.types';
import type {
  Performance,
  StudentException
} from '@/features/weekly-updates/weekly-update.model';
import {
  dismissTeachingUpdateAction,
  saveTeachingUpdateDraftAction,
  submitTeachingUpdateAction
} from './teaching-update.actions';
import {
  initialTeachingUpdateActionState,
  type TeachingUpdate,
  type TeachingUpdateCoverageKind,
  type TeachingUpdateSubmitError
} from './teaching-update.types';
import {getTeachingUpdateSubmitIssues} from './teaching-update-submit-validation';
import {formatTeachingUpdateDate} from './teaching-update-date';

export function TeachingUpdateEditor({
  locale,
  teacherId,
  today,
  update,
  template,
  submissionError
}: {
  locale: 'en' | 'ar';
  teacherId: string;
  today: string;
  update: TeachingUpdate;
  template: ReportTemplateConfig;
  submissionError?: TeachingUpdateSubmitError | null;
}) {
  const router = useRouter();
  const t = useTranslations('teachingUpdates');
  const weekly = useTranslations('weekly');
  const language = useTranslations('language');

  const [state, saveAction, pending] = useActionState(
    saveTeachingUpdateDraftAction,
    initialTeachingUpdateActionState
  );

  const [coverageKind, setCoverageKind] =
    useState<TeachingUpdateCoverageKind>(
      update.coverageKind
    );
  const [periodStart, setPeriodStart] =
    useState(update.periodStart);
  const [periodEnd, setPeriodEnd] =
    useState(update.periodEnd);
  const [dates, setDates] =
    useState<string[]>(update.dates);
  const [dateDraft, setDateDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [showSubmitIssues, setShowSubmitIssues] = useState(false);
  const [progressEn, setProgressEn] =
    useState(update.progressEn ?? '');
  const [progressAr, setProgressAr] =
    useState(update.progressAr ?? '');

  const [attendance, setAttendance] = useState(() =>
    update.roster.map((student) => {
      const previous = update.attendance.find(
        ({studentId}) => studentId === student.id
      );
      return {
        studentId: student.id,
        attended: previous?.attended ?? null,
        total: previous?.total ?? null,
        legacyStatus: previous?.legacyStatus ?? null
      };
    })
  );
  const [sessionTotal, setSessionTotal] = useState('');

  const [exceptions, setExceptions] =
    useState<StudentException[]>(() =>
      update.roster.map(
        (student) =>
          update.exceptions.find(
            ({studentId}) => studentId === student.id
          ) ?? {
            studentId: student.id,
            performanceOverride: null,
            commentEn: null,
            commentAr: null
          }
      )
    );

  useEffect(() => {
    if (state.status !== 'saved') return;

    const timer = setTimeout(() => {
      setDirty(false);
      router.refresh();
    }, 0);

    return () => clearTimeout(timer);
  }, [state, router]);

  const sortedDates = useMemo(
    () => [...new Set(dates)].sort(),
    [dates]
  );

  const effectivePeriodStart =
    coverageKind === 'DATES'
      ? sortedDates[0] ?? periodStart
      : periodStart;

  const effectivePeriodEnd =
    coverageKind === 'DATES'
      ? sortedDates.at(-1) ?? periodEnd
      : periodEnd;

  const readOnly =
    update.status === 'SUBMITTED' ||
    update.status === 'DISMISSED';

  const submitIssues = getTeachingUpdateSubmitIssues({
    coverageKind,
    periodStart: effectivePeriodStart,
    periodEnd: effectivePeriodEnd,
    dates: sortedDates,
    today,
    roster: update.roster,
    attendance,
    unsaved: dirty || pending || state.status === 'error'
  });
  const canSubmit = update.status === 'OPEN' && submitIssues.length === 0;
  // The saved action returns the committed version immediately. A router refresh
  // may not have delivered the new server props when Submit is pressed.
  const effectiveVersion = state.status === 'saved'
    ? Math.max(update.version, state.savedVersion ?? update.version)
    : update.version;

  const localName = (
    english: string,
    arabic: string | null
  ) => locale === 'ar' && arabic ? arabic : english;

  const studentName = (studentId: string) => {
    const student = update.roster.find(
      ({id}) => id === studentId
    )!;

    return localName(
      student.nameEn,
      student.nameAr
    );
  };

  const setAttendanceCount = (
    studentId: string,
    key: 'attended' | 'total',
    raw: string
  ) => {
    const value = raw.trim() === '' ? null : Number(raw);
    setAttendance((items) =>
      items.map((item) =>
        item.studentId === studentId
          ? {...item, [key]: value, legacyStatus: null}
          : item
      )
    );
    setDirty(true);
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
    setDirty(true);
  };

  const localizedTemplateText = (
    english: string | null,
    arabic: string | null
  ) => locale === 'ar' && arabic ? arabic : english;

  const mainReportLabel =
    localizedTemplateText(
      template.mainReportLabelEn,
      template.mainReportLabelAr
    ) ?? template.mainReportLabelEn;

  const mainReportHelp = localizedTemplateText(
    template.mainReportHelpEn,
    template.mainReportHelpAr
  );

  const performanceLabel =
    localizedTemplateText(
      template.performanceLabelEn,
      template.performanceLabelAr
    ) ?? template.performanceLabelEn;

  const studentCommentLabel =
    localizedTemplateText(
      template.studentCommentLabelEn,
      template.studentCommentLabelAr
    ) ?? template.studentCommentLabelEn;

  return (
    <div className="stack teaching-update-workspace">
      {update.requestedByProfileId ? (
        <Alert variant="info">
          <strong>{t('adminRequest')}</strong>
          {update.adminNote ? (
            <p>{update.adminNote}</p>
          ) : null}
        </Alert>
      ) : null}

      <p className="field-help teacher-required-hint">{t('requiredFieldsHint')}</p>

      <form
        action={saveAction}
        className="weekly-form teaching-update-form"
        noValidate
        onChange={() => setDirty(true)}
      >
        <input
          name="locale"
          type="hidden"
          value={locale}
        />
        <input
          name="teacherId"
          type="hidden"
          value={teacherId}
        />
        <input
          name="submissionId"
          type="hidden"
          value={update.id}
        />
        <input
          name="classSubjectId"
          type="hidden"
          value={update.classSubjectId}
        />
        <input
          name="subjectGroupId"
          type="hidden"
          value={update.subjectGroupId ?? ''}
        />
        <input
          name="expectedVersion"
          type="hidden"
          value={effectiveVersion}
        />
        <input
          name="dates"
          type="hidden"
          value={JSON.stringify(sortedDates)}
        />
        <input
          name="attendance"
          type="hidden"
          value={JSON.stringify(
            attendance.filter(({attended, total}) =>
              attended !== null || total !== null
            ).map(({studentId, attended, total}) => ({
              studentId, attended, total
            }))
          )}
        />
        <input
          name="exceptions"
          type="hidden"
          value={JSON.stringify(exceptions)}
        />

        {coverageKind === 'DATES' ? (
          <>
            <input
              name="periodStart"
              type="hidden"
              value={effectivePeriodStart}
            />
            <input
              name="periodEnd"
              type="hidden"
              value={effectivePeriodEnd}
            />
          </>
        ) : null}

        <section className="teacher-update-section">
          <h2>{t('coverage')}</h2>

          <div className="form-grid">
            <label>
              <input
                checked={coverageKind === 'RANGE'}
                disabled={readOnly}
                name="coverageKind"
                onChange={() => {
                  setCoverageKind('RANGE');
                  setDirty(true);
                }}
                type="radio"
                value="RANGE"
              />
              {t('range')}
            </label>

            <label>
              <input
                checked={coverageKind === 'DATES'}
                disabled={readOnly}
                name="coverageKind"
                onChange={() => {
                  setCoverageKind('DATES');
                  if (dates.length === 0) {
                    setDates([periodStart]);
                  }
                  setDirty(true);
                }}
                type="radio"
                value="DATES"
              />
              {t('exactDates')}
            </label>
          </div>

          {coverageKind === 'RANGE' ? (
            <div className="form-grid">
              <label>
                {t('periodStart')} <span className="teacher-required-star" aria-hidden="true">*</span>
                <input
                  disabled={readOnly}
                  name="periodStart"
                  onChange={(event) =>
                    setPeriodStart(event.target.value)
                  }
                  required
                  type="date"
                  value={periodStart}
                />
              </label>

              <label>
                {t('periodEnd')} <span className="teacher-required-star" aria-hidden="true">*</span>
                <input
                  disabled={readOnly}
                  name="periodEnd"
                  onChange={(event) =>
                    setPeriodEnd(event.target.value)
                  }
                  required
                  type="date"
                  value={periodEnd}
                />
              </label>
            </div>
          ) : (
            <div className="stack">
              {!readOnly ? (
                <div className="compact-form">
                  <label>
                    {t('exactDate')} <span className="teacher-required-star" aria-hidden="true">*</span>
                    <input
                      onChange={(event) =>
                        setDateDraft(event.target.value)
                      }
                      type="date"
                      value={dateDraft}
                    />
                  </label>

                  <Button
                    disabled={!dateDraft}
                    onClick={() => {
                      if (!dateDraft) return;
                      setDates((items) =>
                        [...new Set([...items, dateDraft])]
                          .sort()
                      );
                      setDateDraft('');
                      setDirty(true);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    {t('addDate')}
                  </Button>
                </div>
              ) : null}

              {sortedDates.length === 0 ? (
                <p className="empty-state">
                  {t('noExactDates')}
                </p>
              ) : (
                <div className="stack">
                  {sortedDates.map((date) => (
                    <div
                      className="compact-form"
                      key={date}
                    >
                      <time dateTime={date}>{formatTeachingUpdateDate(date, locale)}</time>

                      {!readOnly ? (
                        <Button
                          onClick={() => {
                            setDates((items) =>
                              items.filter(
                                (item) => item !== date
                              )
                            );
                            setDirty(true);
                          }}
                          type="button"
                          variant="ghost"
                        >
                          {t('removeDate')}
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="teacher-update-section">
          <h2>{mainReportLabel}</h2>

          {mainReportHelp ? (
            <p className="field-help">
              {mainReportHelp}
            </p>
          ) : null}

          <label>
            {weekly('progressEn')}
            <textarea
              disabled={readOnly}
              name="progressEn"
              onChange={(event) =>
                setProgressEn(event.target.value)
              }
              rows={4}
              value={progressEn}
            />
          </label>

          <label>
            {weekly('progressAr')}
            <textarea
              dir="rtl"
              disabled={readOnly}
              name="progressAr"
              onChange={(event) =>
                setProgressAr(event.target.value)
              }
              rows={4}
              value={progressAr}
            />
          </label>
        </section>

        <section
          className="teacher-update-section"
          hidden={!template.performanceEnabled}
        >
          <h2>{performanceLabel}</h2>
          <p className="field-help">
            {weekly('performanceOptionalHelp')}
          </p>

          <select
            aria-label={weekly('defaultPerformance')}
            defaultValue={
              update.defaultPerformance ?? ''
            }
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
                {weekly(`performance.${value}`)}
              </option>
            ))}
          </select>
        </section>

        <section className="teacher-update-section">
          <div className="section-heading">
            <div>
              <h2>{weekly('students')}</h2>
              <p className="field-help">
                {weekly('studentsHelp')}
              </p>
            </div>

            {!readOnly && update.roster.length > 0 ? (
              <div className="row-actions">
                <label>
                  {t('sessionsHeld')}
                  <input
                    min={1}
                    onChange={(event) => setSessionTotal(event.target.value)}
                    placeholder="6"
                    type="number"
                    value={sessionTotal}
                  />
                </label>
                <Button
                  disabled={!Number.isInteger(Number(sessionTotal)) ||
                    Number(sessionTotal) < 1}
                  onClick={() => {
                    const total = Number(sessionTotal);
                    setAttendance((items) => items.map((item) => ({
                      ...item, attended: total, total, legacyStatus: null
                    })));
                    setDirty(true);
                  }}
                  type="button"
                  variant="secondary"
                >
                  {t('markAllAttended')}
                </Button>
              </div>
            ) : null}
          </div>

          {update.roster.length === 0 ? (
            <p className="empty-state">
              {weekly('noStudentsForWeek')}
            </p>
          ) : (
            <div className="data-table-wrap teacher-student-table-wrap">
              <table className="data-table teacher-student-table">
                <thead>
                  <tr>
                    <th>{weekly('student')}</th>
                    <th>{weekly('attendance')}</th>
                    <th
                      hidden={
                        !template.performanceEnabled
                      }
                    >
                      {weekly('performanceOverride')}
                    </th>
                    <th
                      hidden={
                        !template.studentCommentsEnabled
                      }
                    >
                      {studentCommentLabel}
                      {' — '}
                      {language('english')}
                    </th>
                    <th
                      hidden={
                        !template.studentCommentsEnabled
                      }
                    >
                      {studentCommentLabel}
                      {' — '}
                      {language('arabic')}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {update.roster.map((student) => {
                    const attendanceItem =
                      attendance.find(
                        ({studentId}) =>
                          studentId === student.id
                      )!;

                    const exceptionItem =
                      exceptions.find(
                        ({studentId}) =>
                          studentId === student.id
                      )!;

                    const name =
                      studentName(student.id);

                    return (
                      <tr key={student.id}>
                        <td data-label={weekly('student')}>
                          <strong className="record-name">{name}</strong>
                        </td>

                        <td data-label={weekly('attendance')}>
                          <div className="row-actions teacher-attendance-fields">
                            <label>
                              {t('sessionsAttended')} <span className="teacher-required-star" aria-hidden="true">*</span>
                              <input
                                aria-label={`${t('sessionsAttended')} — ${name} (${t('requiredForSubmission')})`}
                                aria-invalid={showSubmitIssues && submitIssues.some(
                                  issue => issue.studentId === student.id &&
                                    ['missingBoth', 'missingAttended', 'invalidAttended',
                                     'attendedExceedsTotal'].includes(issue.code)
                                )}
                                className="teacher-attendance-input"
                                disabled={readOnly}
                                min={0}
                                onChange={(event) =>
                                  setAttendanceCount(student.id, 'attended', event.target.value)
                                }
                                type="number"
                                value={attendanceItem.attended ?? ''}
                              />
                            </label>
                            <span aria-hidden="true">/</span>
                            <label>
                              {t('sessionsHeld')} <span className="teacher-required-star" aria-hidden="true">*</span>
                              <input
                                aria-label={`${t('sessionsHeld')} — ${name} (${t('requiredForSubmission')})`}
                                aria-invalid={showSubmitIssues && submitIssues.some(
                                  issue => issue.studentId === student.id &&
                                    ['missingBoth', 'missingTotal', 'invalidTotal',
                                     'attendedExceedsTotal'].includes(issue.code)
                                )}
                                className="teacher-attendance-input"
                                disabled={readOnly}
                                min={0}
                                onChange={(event) =>
                                  setAttendanceCount(student.id, 'total', event.target.value)
                                }
                                type="number"
                                value={attendanceItem.total ?? ''}
                              />
                            </label>
                          </div>
                          {attendanceItem.legacyStatus ? (
                            <small className="field-help">
                              {t('historicalAttendanceUncounted')}
                            </small>
                          ) : null}
                        </td>

                        <td
                          data-label={weekly('performanceOverride')}
                          hidden={
                            !template.performanceEnabled
                          }
                        >
                          <select
                            aria-label={`${weekly('performanceOverride')} — ${name}`}
                            disabled={readOnly}
                            onChange={(event) =>
                              setException(
                                student.id,
                                {
                                  performanceOverride:
                                    (
                                      event.target.value ||
                                      null
                                    ) as
                                      | Performance
                                      | null
                                }
                              )
                            }
                            value={
                              exceptionItem
                                .performanceOverride ??
                              ''
                            }
                          >
                            <option value="">
                              {weekly('useDefault')}
                            </option>
                            {(
                              [
                                'EXCELLENT',
                                'GOOD',
                                'DEVELOPING',
                                'NEEDS_SUPPORT'
                              ] as Performance[]
                            ).map((value) => (
                              <option
                                key={value}
                                value={value}
                              >
                                {weekly(
                                  `performance.${value}`
                                )}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td
                          data-label={`${studentCommentLabel} — ${language('english')}`}
                          hidden={
                            !template
                              .studentCommentsEnabled
                          }
                        >
                          <textarea
                            aria-label={`${weekly('commentEn')} — ${name}`}
                            disabled={readOnly}
                            onChange={(event) =>
                              setException(
                                student.id,
                                {
                                  commentEn:
                                    event.target.value
                                }
                              )
                            }
                            rows={2}
                            value={
                              exceptionItem.commentEn ??
                              ''
                            }
                          />
                        </td>

                        <td
                          data-label={`${studentCommentLabel} — ${language('arabic')}`}
                          hidden={
                            !template
                              .studentCommentsEnabled
                          }
                        >
                          <textarea
                            aria-label={`${weekly('commentAr')} — ${name}`}
                            dir="rtl"
                            disabled={readOnly}
                            onChange={(event) =>
                              setException(
                                student.id,
                                {
                                  commentAr:
                                    event.target.value
                                }
                              )
                            }
                            rows={2}
                            value={
                              exceptionItem.commentAr ??
                              ''
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {state.overlaps.length > 0 ? (
          <div className="alert alert-warning">
            <strong>{t('overlap')}</strong>
            <p>{t('overlapWarning')}</p>
            <ul>
              {state.overlaps.map((item) => (
                <li key={item.id}>
                  {item.periodStart}
                  {' — '}
                  {item.periodEnd}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {state.error ? (
          <div className="form-error" role="alert" aria-live="polite">
            <p>{t(`saveIssue.${state.error}`)}</p>
            {state.issues?.length ? (
              <ul>
                {state.issues.map((issue, index) => (
                  <li key={`${issue.field}-${index}`}>
                    {formatValidationIssue(issue, locale)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {!readOnly ? (
          <div className="sticky-actions">
            <span
              aria-live="polite"
              className="save-status"
            >
              {pending
                ? t('saving')
                : state.status === 'error'
                  ? t('notSaved')
                  : dirty
                    ? t('unsaved')
                    : t('saved')}
            </span>

            <Button
              disabled={pending}
              type="submit"
            >
              {t('saveDraft')}
            </Button>
          </div>
        ) : null}
      </form>

      {update.status === 'OPEN' ? (
        <section className="teacher-update-submit">
          {submissionError && state.status !== 'saved' ? (
            <p className="form-error" role="alert">
              {t(`submitError.${submissionError}`)}
            </p>
          ) : null}
          {submitIssues.length > 0 ? (
            <div
              className="teacher-submit-issues"
              role={showSubmitIssues ? 'alert' : 'status'}
            >
              <p>{t('submitRequirementsCount', {count: submitIssues.length})}</p>
              {showSubmitIssues || submissionError ? (
                <ul>
                  {submitIssues.map((issue, index) => (
                    <li key={`${issue.studentId ?? 'coverage'}-${issue.code}-${index}`}>
                      {issue.studentId
                        ? t(`submitIssue.${issue.code}`, {
                            student: studentName(issue.studentId)
                          })
                        : t(`submitIssue.${issue.code}`)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="field-help">{t('submitCheckHint')}</p>
              )}
            </div>
          ) : null}
          <div className="form-actions">
            <form
              action={submitTeachingUpdateAction}
              onSubmit={(event) => {
                if (!canSubmit) {
                  event.preventDefault();
                  setShowSubmitIssues(true);
                }
              }}
            >
              <input
                name="locale"
                type="hidden"
                value={locale}
              />
              <input
                name="teacherId"
                type="hidden"
                value={teacherId}
              />
              <input
                name="submissionId"
                type="hidden"
                value={update.id}
              />
              <input
                name="expectedVersion"
                type="hidden"
                value={effectiveVersion}
              />

              <Button
                disabled={pending}
                type="submit"
              >
                {t('submit')}
              </Button>
            </form>

            <form action={dismissTeachingUpdateAction}>
              <input
                name="locale"
                type="hidden"
                value={locale}
              />
              <input
                name="teacherId"
                type="hidden"
                value={teacherId}
              />
              <input
                name="submissionId"
                type="hidden"
                value={update.id}
              />
              <input
                name="expectedVersion"
                type="hidden"
                value={effectiveVersion}
              />

              {update.requestedByProfileId ? (
                <label>
                  {t('dismissReason')}
                  <input
                    name="reason"
                    required
                  />
                </label>
              ) : (
                <input
                  name="reason"
                  type="hidden"
                  value=""
                />
              )}

              <Button
                type="submit"
                variant="ghost"
              >
                {t('dismiss')}
              </Button>
            </form>
          </div>

        </section>
      ) : (
        <p className="status-badge status-active">
          {t(`status.${update.status}`)}
        </p>
      )}
    </div>
  );
}
