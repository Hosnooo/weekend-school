import {getTranslations} from 'next-intl/server';

import {Badge} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';

import {
  requestReportCycleMissingUpdateAction,
  setReportCycleSourceIncludedAction
} from './admin-report-workflow.actions';
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

  return (
    <Card className="content-section">
      <div className="section-heading">
        <div>
          <h2>{t('sourcesStage')}</h2>
          <p>{t('sourcesHelp')}</p>
        </div>

        <Badge variant="info">
          {sources.filter(({included}) => included).length}
          {' / '}
          {sources.length}
        </Badge>
      </div>

      {sources.length === 0 ? (
        <p>{t('noCycleSources')}</p>
      ) : (
        <div className="stack-list">
          {sources.map((source) => {
            const coverage =
              source.coverageKind === 'DATES'
                ? source.coveredDates.join(', ')
                : `${source.periodStart} – ${source.periodEnd}`;

            return (
              <article
                className="record-card"
                key={source.id}
              >
                <div className="record-card-main">
                  <div className="row-actions">
                    <strong>
                      {localize(
                        source.subjectNameEn,
                        source.subjectNameAr
                      )}
                      {source.groupNameEn
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

                  <p className="report-batch-meta">
                    {coverage}
                    {' · '}
                    {source.teacherName}
                  </p>
                </div>

                {status !== 'FINALIZED' ? (
                  <form
                    action={
                      setReportCycleSourceIncludedAction
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

          <div className="stack-list">
            {missingContexts.map((context) => (
              <article
                className="record-card"
                key={`${context.classSubjectId}:${context.subjectGroupId ?? 'whole'}`}
              >
                <div className="record-card-main">
                  <strong>
                    {localize(
                      context.subjectNameEn,
                      context.subjectNameAr
                    )}
                    {context.groupNameEn
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
    </Card>
  );
}
