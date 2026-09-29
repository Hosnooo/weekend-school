import {getTranslations} from 'next-intl/server';

import {Badge} from '@/components/ui/badge';
import {Link} from '@/i18n/navigation';
import {formatTeachingUpdateRange} from './teaching-update-date';

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
  locale: 'en' | 'ar';
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
    <section className="teacher-task-section">
      <h2>{t('openUpdates')}</h2>

      <div className="teacher-task-list">
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
            <article className="teacher-task-row" key={update.id}>
              <div className="teacher-task-main">
                <div className="teacher-task-badges">
                  <Badge variant="warning">{t('status.OPEN')}</Badge>
                  {update.requestSetId ? <Badge variant="info">{t('adminRequest')}</Badge> : null}
                </div>
                <h3>
                  {context
                    ? localName(context.subjectNameEn, context.subjectNameAr)
                    : t('teachingUpdate')}
                </h3>
                {context ? (
                  <p className="record-meta">
                    {localName(context.classNameEn, context.classNameAr)}
                    {' · '}
                    {context.subjectGroupId
                      ? localName(context.groupNameEn ?? '', context.groupNameAr)
                      : t('wholeSubject')}
                  </p>
                ) : null}
                <p className="record-meta">
                  {update.coverageKind === 'DATES' ? `${t('exactDates')} · ` : null}
                  {formatTeachingUpdateRange(update.periodStart, update.periodEnd, locale)}
                </p>
              </div>
              <Link
                className="button button-primary button-compact action-link"
                href={`/my-teaching/update?submissionId=${update.id}`}
              >
                {t('continue')}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
