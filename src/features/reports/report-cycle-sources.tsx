import {getTranslations} from 'next-intl/server';

import {Badge} from '@/components/ui/badge';
import {formatTeachingUpdateDate, formatTeachingUpdateRange} from '@/features/teaching-updates/teaching-update-date';

import {
  requestReportCycleMissingUpdateAction
} from './admin-report-workflow.actions';
import {
  setClassReportCycleSourceIncludedAction
} from './class-report-source.actions';
import type {
  ClassReportCycleMissingContext,
  ReportBatchSource
} from './report-batch.repository';

export async function ReportCycleSources({
  batchId,
  locale,
  periodStart,
  periodEnd,
  status,
  sources,
  missingContexts
}: {
  batchId: string;
  locale: string;
  periodStart: string;
  periodEnd: string;
  status: 'DRAFT' | 'REVIEW' | 'FINALIZED';
  sources: ReportBatchSource[];
  missingContexts: ClassReportCycleMissingContext[];
}) {
  const t = await getTranslations({
    locale,
    namespace: 'reports'
  });

  const localize = (
    en: string | null,
    ar: string | null
  ) => locale === 'ar' && ar ? ar : en ?? ar ?? '—';
  const activeLocale = locale === 'ar' ? 'ar' : 'en';
  const editUpdate = locale === 'ar' ? 'تعديل التحديث' : 'Edit update';

  return (
    <section className="detail-section report-cycle-sources">
      <div className="section-heading">
        <div>
          <h2>{t('sourcesStage')}</h2>
          <p>{t('sourcesHelp')}</p>
        </div>

        <span className="record-meta">
          {sources.filter(({included}) => included).length}
          {' / '}
          {sources.length}
          {' '}
          {t('sourceIncluded')}
        </span>
      </div>

      {sources.length === 0 ? (
        <p>{t('noCycleSources')}</p>
      ) : (
        <div className="report-source-list">
          {sources.map((source) => {
            const coverage =
              source.coverageKind === 'DATES'
                ? source.coveredDates.map((date) => formatTeachingUpdateDate(date, activeLocale)).join(', ')
                : formatTeachingUpdateRange(source.periodStart, source.periodEnd, activeLocale);
            const editorId = `report-edit-${source.classSubjectId}-${source.subjectGroupId ?? 'whole'}`;

            return (
              <article
                className="report-source-row"
                key={source.id}
              >
                <div className="report-source-main">
                  <div className="row-actions">
                    <strong className="record-name">
                      {localize(
                        source.subjectNameEn,
                        source.subjectNameAr
                      )}
                      {source.subjectGroupId
                        ? ` · ${localize(
                            source.groupNameEn,
                            source.groupNameAr
                          )}`
                        : ''}
                    </strong>

                    <Badge
                      variant={
                        source.included
                          ? 'success'
                          : 'neutral'
                      }
                    >
                      {source.included
                        ? t('sourceIncluded')
                        : t('sourceExcluded')}
                    </Badge>

                    {source.partialOverlap ? (
                      <Badge variant="warning">
                        {t('partialOverlap')}
                      </Badge>
                    ) : null}
                  </div>

                  <p className="record-meta">
                    {coverage}
                    {' · '}
                    {source.teacherName}
                  </p>

                  {status !== 'FINALIZED' ? (
                    <a
                      className="button button-secondary action-link"
                      href={`#${editorId}`}
                    >
                      {editUpdate}
                    </a>
                  ) : null}
                </div>

                {status !== 'FINALIZED' ? (
                  <form
                    action={
                      setClassReportCycleSourceIncludedAction
                    }
                  >
                    <input
                      name="locale"
                      type="hidden"
                      value={locale}
                    />
                    <input
                      name="batchId"
                      type="hidden"
                      value={batchId}
                    />
                    <input
                      name="submissionId"
                      type="hidden"
                      value={source.id}
                    />
                    <input
                      name="included"
                      type="hidden"
                      value={
                        source.included
                          ? 'false'
                          : 'true'
                      }
                    />

                    <button
                      className="button button-secondary"
                      type="submit"
                    >
                      {source.included
                        ? t('excludeSource')
                        : t('includeSource')}
                    </button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {missingContexts.length > 0 ? (
        <section className="stack">
          <div>
            <h3>{t('missingUpdates')}</h3>
            <p>{t('missingUpdatesHelp')}</p>
          </div>

          <div className="report-source-list">
            {missingContexts.map((context) => (
              <article
                className="report-source-row"
                key={`${context.classSubjectId}:${context.subjectGroupId ?? 'whole'}`}
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

                {status !== 'FINALIZED' ? (
                  <form
                    action={
                      requestReportCycleMissingUpdateAction
                    }
                  >
                    <input
                      name="locale"
                      type="hidden"
                      value={locale}
                    />
                    <input
                      name="batchId"
                      type="hidden"
                      value={batchId}
                    />
                    <input
                      name="classSubjectId"
                      type="hidden"
                      value={context.classSubjectId}
                    />
                    <input
                      name="periodStart"
                      type="hidden"
                      value={periodStart}
                    />
                    <input
                      name="periodEnd"
                      type="hidden"
                      value={periodEnd}
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
