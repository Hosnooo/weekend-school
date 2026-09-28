'use client';

import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {
  archiveTeacherSubjectGroupAction,
  createTeacherSubjectGroupAction,
  moveTeacherSubjectGroupStudentAction,
  removeTeacherSubjectGroupStudentAction,
  renameTeacherSubjectGroupAction,
  restoreTeacherSubjectGroupAction
} from '@/features/classes/class.actions';
import type {
  TeacherSubjectGroupManagement
} from '@/features/classes/class.types';
import type {Locale} from '@/i18n/config';

export function TeacherSubjectGroupManager({
  locale,
  today,
  management,
  classNameEn,
  classNameAr,
  subjectNameEn,
  subjectNameAr
}: {
  locale: Locale;
  today: string;
  management: TeacherSubjectGroupManagement;
  classNameEn: string;
  classNameAr: string | null;
  subjectNameEn: string;
  subjectNameAr: string | null;
}) {
  const t = useTranslations('classes');
  const common = useTranslations('common');

  const localName = (en: string, ar: string | null) =>
    locale === 'ar' && ar ? ar : en;

  const groupById = new Map(
    management.groups.map((group) => [group.id, group])
  );

  return (
    <Card className="record-card">
      <div className="section-heading">
        <div>
          <h2>
            {localName(subjectNameEn, subjectNameAr)}
            {' · '}
            {localName(classNameEn, classNameAr)}
          </h2>
          <p className="muted-text">
            <strong>{t('manageMyGroups')}</strong>
            {' — '}
            {t('teacherGroupHelp')}
          </p>
        </div>
      </div>

      <section className="subsection">
        <h3>{t('groups')}</h3>

        <form action={createTeacherSubjectGroupAction} className="form-grid">
          <input
            name="classSubjectId"
            type="hidden"
            value={management.classSubjectId}
          />
          <input name="locale" type="hidden" value={locale} />

          <label>
            {t('groupNameEn')}
            <input name="nameEn" required />
          </label>

          <label>
            {t('groupNameAr')}
            <input dir="rtl" name="nameAr" />
          </label>

          <div className="form-actions">
            <Button type="submit">{t('createGroup')}</Button>
          </div>
        </form>

        {management.groups.length === 0 ? (
          <p className="empty-state">{t('noGroups')}</p>
        ) : (
          <div className="stack">
            {management.groups.map((group) => (
              <div className="record-card compact-card" key={group.id}>
                <form
                  action={renameTeacherSubjectGroupAction}
                  className="form-grid"
                >
                  <input
                    name="subjectGroupId"
                    type="hidden"
                    value={group.id}
                  />
                  <input name="locale" type="hidden" value={locale} />

                  <label>
                    {t('groupNameEn')}
                    <input
                      defaultValue={group.nameEn}
                      name="nameEn"
                      required
                    />
                  </label>

                  <label>
                    {t('groupNameAr')}
                    <input
                      defaultValue={group.nameAr ?? ''}
                      dir="rtl"
                      name="nameAr"
                    />
                  </label>

                  <div className="form-actions">
                    <Button type="submit" variant="secondary">
                      {t('renameGroup')}
                    </Button>
                  </div>
                </form>

                <form
                  action={
                    group.isActive
                      ? archiveTeacherSubjectGroupAction
                      : restoreTeacherSubjectGroupAction
                  }
                >
                  <input
                    name="subjectGroupId"
                    type="hidden"
                    value={group.id}
                  />
                  <input name="locale" type="hidden" value={locale} />
                  <Button
                    type="submit"
                    variant={group.isActive ? 'ghost' : 'secondary'}
                  >
                    {group.isActive ? t('archive') : t('restore')}
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="subsection">
        <h3>{t('student')}</h3>

        {management.students.length === 0 ? (
          <p className="empty-state">{t('noStudents')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('student')}</th>
                  <th>{t('currentGroup')}</th>
                  <th>{common('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {management.students.map((student) => {
                  const current = student.currentGroupId
                    ? groupById.get(student.currentGroupId)
                    : null;

                  return (
                    <tr key={student.id}>
                      <td>{localName(student.nameEn, student.nameAr)}</td>
                      <td>
                        {current
                          ? localName(current.nameEn, current.nameAr)
                          : t('ungrouped')}
                      </td>
                      <td>
                        <form
                          action={moveTeacherSubjectGroupStudentAction}
                          className="compact-form"
                        >
                          <input
                            name="classSubjectId"
                            type="hidden"
                            value={management.classSubjectId}
                          />
                          <input
                            name="studentId"
                            type="hidden"
                            value={student.id}
                          />
                          <input
                            name="locale"
                            type="hidden"
                            value={locale}
                          />

                          <label>
                            {t('moveToGroup')}
                            <select
                              defaultValue={student.currentGroupId ?? ''}
                              name="subjectGroupId"
                              required
                            >
                              <option disabled value="">
                                {t('ungrouped')}
                              </option>
                              {management.groups
                                .filter(({isActive}) => isActive)
                                .map((group) => (
                                  <option key={group.id} value={group.id}>
                                    {localName(group.nameEn, group.nameAr)}
                                  </option>
                                ))}
                            </select>
                          </label>

                          <label>
                            {t('effectiveOn')}
                            <input
                              defaultValue={today}
                              name="onDate"
                              required
                              type="date"
                            />
                          </label>

                          <Button type="submit" variant="secondary">
                            {t('moveToGroup')}
                          </Button>
                        </form>

                        {student.currentGroupId ? (
                          <form
                            action={removeTeacherSubjectGroupStudentAction}
                            className="compact-form"
                          >
                            <input
                              name="classSubjectId"
                              type="hidden"
                              value={management.classSubjectId}
                            />
                            <input
                              name="studentId"
                              type="hidden"
                              value={student.id}
                            />
                            <input
                              name="locale"
                              type="hidden"
                              value={locale}
                            />
                            <input
                              defaultValue={today}
                              name="onDate"
                              type="hidden"
                            />
                            <Button type="submit" variant="ghost">
                              {t('removeFromGroup')}
                            </Button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="subsection">
        <h3>{t('membershipHistory')}</h3>

        {management.membershipHistory.length === 0 ? (
          <p className="empty-state">{t('noMembershipHistory')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('student')}</th>
                  <th>{t('groups')}</th>
                  <th>{t('startsOn')}</th>
                  <th>{t('endsOnOptional')}</th>
                </tr>
              </thead>
              <tbody>
                {management.membershipHistory.map((membership) => (
                  <tr key={membership.id}>
                    <td>
                      {localName(
                        membership.studentNameEn,
                        membership.studentNameAr
                      )}
                    </td>
                    <td>
                      {localName(
                        membership.groupNameEn,
                        membership.groupNameAr
                      )}
                    </td>
                    <td>{membership.startsOn}</td>
                    <td>{membership.endsOn ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Card>
  );
}
