import {getTranslations} from 'next-intl/server';

import {setDefaultGroupAction} from '@/features/classes/class.actions';
import type {ClassSubjectSummary} from '@/features/classes/class.types';
import {SubjectGroupForm} from '@/features/classes/subject-group-form';
import type {Locale} from '@/i18n/config';

export async function ClassSubjectCard({
  locale,
  classId,
  subject
}: {
  locale: Locale;
  classId: string;
  subject: ClassSubjectSummary;
}) {
  const t = await getTranslations({locale, namespace: 'classes'});
  const subjectName =
    locale === 'ar' && subject.subjectNameAr
      ? subject.subjectNameAr
      : subject.subjectNameEn;

  return (
    <article className="subject-card">
      <header className="subject-card-heading">
        <div>
          <h3>{subjectName}</h3>
          <p className="muted-text">
            {subject.groups.length === 0
              ? t('wholeClass')
              : t('groupCount', {count: subject.groups.length})}
            {' · '}
            {t('teacherCount', {count: subject.teacherCount})}
          </p>
        </div>
      </header>

      {subject.groups.length === 0 ? (
        <p className="empty-inline">{t('noGroups')}</p>
      ) : (
        <>
          <ul className="group-list">
            {subject.groups.map((group) => {
              const groupName =
                locale === 'ar' && group.nameAr ? group.nameAr : group.nameEn;
              return (
                <li key={group.id} className="group-list-item">
                  <span>
                    <strong>{groupName}</strong>
                    {group.isDefault ? (
                      <span className="status-badge status-active">
                        {t('defaultGroup')}
                      </span>
                    ) : null}
                  </span>
                  {!group.isDefault ? (
                    <form action={setDefaultGroupAction}>
                      <input name="locale" type="hidden" value={locale} />
                      <input name="classId" type="hidden" value={classId} />
                      <input name="classSubjectId" type="hidden" value={subject.id} />
                      <input name="subjectGroupId" type="hidden" value={group.id} />
                      <button className="text-button" type="submit">
                        {t('makeDefault')}
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="form-hint">{t('defaultGroupHelp')}</p>
        </>
      )}

      <details className="disclosure-card">
        <summary>{t('addGroup')}</summary>
        <SubjectGroupForm
          classId={classId}
          classSubjectId={subject.id}
          locale={locale}
        />
      </details>
    </article>
  );
}
