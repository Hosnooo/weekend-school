import {getTranslations} from 'next-intl/server';

import {Badge} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';
import {Link} from '@/i18n/navigation';

type Update = {
  id: string;
  classSubjectId: string;
  subjectGroupId: string | null;
  requestSetId: string | null;
  coverageKind: 'RANGE' | 'DATES';
  periodStart: string;
  periodEnd: string;
};

type Context = {
  classSubjectId: string;
  subjectGroupId: string | null;
  classNameEn: string;
  classNameAr: string | null;
  subjectNameEn: string;
  subjectNameAr: string | null;
  groupNameEn: string | null;
  groupNameAr: string | null;
};

export async function TeachingUpdateTaskList({
  contexts,
  locale,
  updates
}: {
  contexts: Context[];
  locale: string;
  updates: Update[];
}) {
  if (updates.length === 0) return null;

  const t = await getTranslations({
    locale,
    namespace: 'teachingUpdates'
  });

  const localName = (en: string, ar: string | null) =>
    locale === 'ar' && ar ? ar : en;

  return (
    <div className="stack">
      <h2>{t('openUpdates')}</h2>

      <div className="group-cards">
        {updates.map((update) => {
          const context =
            contexts.find(
              (item) =>
                item.classSubjectId === update.classSubjectId &&
                item.subjectGroupId === update.subjectGroupId
            ) ??
            contexts.find(
              (item) => item.classSubjectId === update.classSubjectId
            );

          return (
            <Card className="group-card" key={update.id}>
              <div className="stack">
                <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                  <Badge variant="warning">{t('status.OPEN')}</Badge>
                  {update.requestSetId ? (
                    <Badge variant="info">{t('adminRequest')}</Badge>
                  ) : null}
                </div>

                <div>
                  <h3>
                    {context
                      ? localName(context.subjectNameEn, context.subjectNameAr)
                      : t('teachingUpdate')}
                  </h3>
                  {context ? (
                    <p>
                      {localName(context.classNameEn, context.classNameAr)}
                      {' · '}
                      {context.subjectGroupId
                        ? localName(
                            context.groupNameEn ?? '',
                            context.groupNameAr
                          )
                        : t('wholeSubject')}
                    </p>
                  ) : null}
                </div>

                <small>
                  {update.coverageKind === 'DATES'
                    ? t('exactDates')
                    : `${update.periodStart} — ${update.periodEnd}`}
                </small>

                <Link
                  className="button button-primary action-link"
                  href={`/my-teaching/update?submissionId=${update.id}`}
                >
                  {t('continue')}
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
