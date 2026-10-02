import {getTranslations} from 'next-intl/server';

import {Alert} from '@/components/ui/alert';
import {Badge} from '@/components/ui/badge';
import {EmptyState} from '@/components/ui/empty-state';
import {formatTeachingUpdateDate, formatTeachingUpdateRange} from '@/features/teaching-updates/teaching-update-date';
import type {Locale} from '@/i18n/config';

import {
  requestReportCycleMissingUpdateAction
} from './admin-report-workflow.actions';
import type {ClassReportReviewWorkspaceWithAttendance} from './class-report-attendance.repository';
import {
  setClassReportCycleSourceIncludedAction
} from './class-report-source.actions';
import {saveClassReportReviewWithAttendanceInlineAction} from './class-report-review.actions';
import type {
  ClassReportCycleWorkspace,
  ReportBatchSource
} from './report-batch.repository';
import {ReportEditForm} from './report-edit-form';
import type {ReportPerformance} from './report.types';

const performanceValues: ReportPerformance[] = [
  'EXCELLENT',
  'GOOD',
  'DEVELOPING',
  'NEEDS_SUPPORT'
];

const copy = {
  en: {
    editUpdate: 'Edit update',
    customizeReportText: 'Customize report text',
    customizeReportTextHelp:
      'Leave blank to use the shared report text for this student.',
    attendance: 'Attendance',
    attended: 'Attended',
    outOf: 'out of',
    sessions: 'sessions',
    attendanceNeedsReview:
      'Source attendance disagrees. Confirm the attended and total session counts before finalizing.',
    saveAndClose: 'Save & close',
    cancel: 'Cancel'
  },
  ar: {
    editUpdate: 'تعديل التحديث',
    customizeReportText: 'تخصيص نص التقرير',
    customizeReportTextHelp:
      'اتركه فارغاً لاستخدام نص التقرير المشترك لهذا الطالب.',
    attendance: 'الحضور',
    attended: 'حضر',
    outOf: 'من أصل',
    sessions: 'حصص',
    attendanceNeedsReview:
      'توجد اختلافات في بيانات الحضور. يرجى تأكيد عدد الحصص المحضورة وإجمالي الحصص قبل الإنهاء.',
    saveAndClose: 'حفظ وإغلاق',
    cancel: 'إلغاء'
  }
} as const;

function contextKey(
  classSubjectId: string,
  subjectGroupId: string | null
) {
  return `${classSubjectId}:${subjectGroupId ?? 'whole'}`;
}

export async function ReportCycleSourceReview({
  classCycle,
  locale,
  review
}: {
  classCycle: ClassReportCycleWorkspace;
  locale: Locale;
  review: ClassReportReviewWorkspaceWithAttendance;
}) {
  const [t, weekly] = await Promise.all([
    getTranslations({locale, namespace: 'reports'}),
    getTranslations({locale, namespace: 'weekly'})
  ]);
  const ui = copy[locale];
  const activeLocale = locale === 'ar' ? 'ar' : 'en';

  const localize = (
    en: string | null | undefined,
    ar: string | null | undefined,
    fallback = '—'
  ) => {
    if (locale === 'ar' && ar?.trim()) return ar;
    if (en?.trim()) return en;
    if (ar?.trim()) return ar;
    return fallback;
  };

  const groupedSources = new Map<string, ReportBatchSource[]>();
  for (const source of classCycle.sources) {
    const key = contextKey(
      source.classSubjectId,
      source.subjectGroupId
    );
    const current = groupedSources.get(key) ?? [];
    current.push(source);
    groupedSources.set(key, current);
  }

  const contexts = new Map(
    review.contexts.map((context) => [
      contextKey(context.classSubjectId, context.subjectGroupId),
      context
    ])
  );

  const sharedHidden = (
    <>
      <input name="locale" type="hidden" value={locale} />
      <input name="batchId" type="hidden" value={classCycle.batch.id} />
      <input
        name="periodStart"
        type="hidden"
        value={classCycle.batch.periodStart}
      />
      <input
        name="periodEnd"
        type="hidden"
        value={classCycle.batch.periodEnd}
      />
    </>
  );

  const coverageFor = (source: ReportBatchSource) =>
    source.coverageKind === 'DATES'
      ? source.coveredDates
          .map((date) =>
            formatTeachingUpdateDate(date, activeLocale)
          )
          .join(', ')
      : formatTeachingUpdateRange(
          source.periodStart,
          source.periodEnd,
          activeLocale
        );

  return (
    <section className="detail-section report-cycle-sources">
      <style>{`
        .report-edit-panel { display: none; }
        .report-edit-panel:target { display: block; }
      `}</style>

      <div className="section-heading">
        <div>
          <h2>{t('sourcesStage')}</h2>
          <p>{t('sourcesHelp')}</p>
        </div>

        <span className="record-meta">
          {classCycle.sources.filter(({included}) => included).length}
          {' / '}
          {classCycle.sources.length}
          {' '}
          {t('sourceIncluded')}
        </span>
      </div>

      {groupedSources.size === 0 ? (
        <EmptyState title={t('noCycleSources')} />
      ) : (
        <div className="report-source-context-list">
          {[...groupedSources.entries()].map(([key, sources]) => {
            const source = sources[0];
            const context = contexts.get(key);
            const editorId =
              `report-edit-${source.classSubjectId}-${source.subjectGroupId ?? 'whole'}`;
            const title = [
              localize(source.subjectNameEn, source.subjectNameAr),
              source.groupNameEn || source.groupNameAr
                ? localize(source.groupNameEn, source.groupNameAr)
                : null
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <article
                className="report-source-context report-source-editable"
                key={key}
              >
                <div className="report-source-context-header">
                  <div>
                    <strong className="record-name">{title}</strong>
                    {sources.length > 1 ? (
                      <p className="record-meta">
                        {t('submissionCount', {count: sources.length})}
                      </p>
                    ) : null}
                  </div>

                  {classCycle.batch.status !== 'FINALIZED' && context ? (
                    <a
                      className="button button-secondary action-link"
                      href={`#${editorId}`}
                    >
                      {ui.editUpdate}
                    </a>
                  ) : null}
                </div>

                <div className="report-source-submissions">
                  {sources.map((item) => (
                    <div className="report-source-row" key={item.id}>
                      <div className="report-source-main">
                        <div className="row-actions">
                          <Badge
                            variant={item.included ? 'success' : 'neutral'}
                          >
                            {item.included
                              ? t('sourceIncluded')
                              : t('sourceExcluded')}
                          </Badge>

                          {item.partialOverlap ? (
                            <Badge variant="warning">
                              {t('partialOverlap')}
                            </Badge>
                          ) : null}
                        </div>

                        <p className="record-meta">
                          {coverageFor(item)}
                          {' · '}
                          {item.teacherName}
                        </p>
                      </div>

                      {classCycle.batch.status !== 'FINALIZED' ? (
                        <form action={setClassReportCycleSourceIncludedAction}>
                          <input name="locale" type="hidden" value={locale} />
                          <input
                            name="batchId"
                            type="hidden"
                            value={classCycle.batch.id}
                          />
                          <input
                            name="submissionId"
                            type="hidden"
                            value={item.id}
                          />
                          <input
                            name="included"
                            type="hidden"
                            value={item.included ? 'false' : 'true'}
                          />
                          <button
                            className="button button-secondary"
                            type="submit"
                          >
                            {item.included
                              ? t('excludeSource')
                              : t('includeSource')}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>

                {classCycle.batch.status !== 'FINALIZED' && context ? (
                  <div
                    className="report-edit-panel report-source-editor"
                    id={editorId}
                  >
                    <ReportEditForm
                      cancelLabel={ui.cancel}
                      saveAction={saveClassReportReviewWithAttendanceInlineAction}
                      saveErrorLabel={t('saveError')}
                      saveLabel={ui.saveAndClose}
                    >
                      {sharedHidden}
                      <input
                        name="classSubjectId"
                        type="hidden"
                        value={context.classSubjectId}
                      />
                      <input
                        name="subjectGroupId"
                        type="hidden"
                        value={context.subjectGroupId ?? ''}
                      />

                      <section>
                        <div className="form-grid">
                          <label>
                            {t('englishField')}
                            <textarea
                              defaultValue={context.mainReportEn ?? ''}
                              dir="ltr"
                              name="mainReportEn"
                              rows={6}
                            />
                          </label>
                          <label>
                            {t('arabicField')}
                            <textarea
                              defaultValue={context.mainReportAr ?? ''}
                              dir="rtl"
                              name="mainReportAr"
                              rows={6}
                            />
                          </label>
                        </div>
                      </section>

                      {review.template.performanceEnabled ? (
                        <input
                          name="includePerformance"
                          type="hidden"
                          value="1"
                        />
                      ) : null}
                      {review.template.studentCommentsEnabled ? (
                        <input
                          name="includeStudentComments"
                          type="hidden"
                          value="1"
                        />
                      ) : null}

                      <section>
                        <h4>{weekly('students')}</h4>
                        <div className="stack-list">
                          {context.students.map((student) => (
                            <article
                              className="record-card"
                              key={student.studentId}
                            >
                              <div className="record-card-main stack">
                                <strong className="record-name">
                                  {localize(
                                    student.studentNameEn,
                                    student.studentNameAr
                                  )}
                                </strong>
                                <input
                                  name="studentId"
                                  type="hidden"
                                  value={student.studentId}
                                />

                                <div>
                                  <strong>{ui.attendance}</strong>
                                  <div className="row-actions">
                                    <label>
                                      {ui.attended}
                                      <input
                                        defaultValue={
                                          student.attendanceAttended ?? ''
                                        }
                                        min="0"
                                        name={`attendanceAttended:${student.studentId}`}
                                        step="1"
                                        type="number"
                                      />
                                    </label>
                                    <span>{ui.outOf}</span>
                                    <label>
                                      {ui.sessions}
                                      <input
                                        defaultValue={
                                          student.attendanceTotal ?? ''
                                        }
                                        min="0"
                                        name={`attendanceTotal:${student.studentId}`}
                                        step="1"
                                        type="number"
                                      />
                                    </label>
                                  </div>

                                  {student.attendanceUnresolvedConflicts > 0 ? (
                                    <Alert variant="warning">
                                      {ui.attendanceNeedsReview}
                                    </Alert>
                                  ) : null}
                                </div>

                                {review.template.performanceEnabled ? (
                                  <label>
                                    {t('performance')}
                                    <select
                                      defaultValue={
                                        student.performanceOverridden
                                          ? student.performance ?? ''
                                          : ''
                                      }
                                      name={`performance:${student.studentId}`}
                                    >
                                      <option value="">
                                        {weekly('useDefault')}
                                      </option>
                                      {performanceValues.map((value) => (
                                        <option key={value} value={value}>
                                          {weekly(`performance.${value}`)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ) : null}

                                {review.template.studentCommentsEnabled ? (
                                  <div className="form-grid">
                                    <label>
                                      {t('englishField')}
                                      <textarea
                                        defaultValue={student.commentEn ?? ''}
                                        dir="ltr"
                                        name={`commentEn:${student.studentId}`}
                                        rows={2}
                                      />
                                    </label>
                                    <label>
                                      {t('arabicField')}
                                      <textarea
                                        defaultValue={student.commentAr ?? ''}
                                        dir="rtl"
                                        name={`commentAr:${student.studentId}`}
                                        rows={2}
                                      />
                                    </label>
                                  </div>
                                ) : null}

                                <details>
                                  <summary>{ui.customizeReportText}</summary>
                                  <p className="field-help">
                                    {ui.customizeReportTextHelp}
                                  </p>
                                  <div className="form-grid">
                                    <label>
                                      {t('englishField')}
                                      <textarea
                                        defaultValue={student.progressEn ?? ''}
                                        dir="ltr"
                                        name={`progressEn:${student.studentId}`}
                                        rows={4}
                                      />
                                    </label>
                                    <label>
                                      {t('arabicField')}
                                      <textarea
                                        defaultValue={student.progressAr ?? ''}
                                        dir="rtl"
                                        name={`progressAr:${student.studentId}`}
                                        rows={4}
                                      />
                                    </label>
                                  </div>
                                </details>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    </ReportEditForm>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <span id="report-edit-closed" />

      {classCycle.missingContexts.length > 0 ? (
        <section className="stack report-missing-updates">
          <div>
            <h3>{t('missingUpdates')}</h3>
            <p>{t('missingUpdatesHelp')}</p>
          </div>

          <div className="report-source-list">
            {classCycle.missingContexts.map((context) => (
              <article
                className="report-source-row"
                key={contextKey(
                  context.classSubjectId,
                  context.subjectGroupId
                )}
              >
                <div className="report-source-main">
                  <strong className="record-name">
                    {localize(
                      context.subjectNameEn,
                      context.subjectNameAr
                    )}
                    {context.subjectGroupId
                      ? ` · ${localize(
                          context.groupNameEn,
                          context.groupNameAr
                        )}`
                      : ''}
                  </strong>
                </div>

                {classCycle.batch.status !== 'FINALIZED' ? (
                  <form action={requestReportCycleMissingUpdateAction}>
                    <input name="locale" type="hidden" value={locale} />
                    <input
                      name="batchId"
                      type="hidden"
                      value={classCycle.batch.id}
                    />
                    <input
                      name="classSubjectId"
                      type="hidden"
                      value={context.classSubjectId}
                    />
                    <input
                      name="periodStart"
                      type="hidden"
                      value={classCycle.batch.periodStart}
                    />
                    <input
                      name="periodEnd"
                      type="hidden"
                      value={classCycle.batch.periodEnd}
                    />
                    <button
                      className="button button-secondary"
                      type="submit"
                    >
                      {t('requestMissingUpdate')}
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
