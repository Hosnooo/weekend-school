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

  const studentsForGroup = (groupId: string | null) =>
    management.students.filter(
      (student) => student.currentGroupId === groupId
    );

  const activeGroups = management.groups.filter(({isActive}) => isActive);
  const rosterGroups = management.groups.filter(
    (group) => group.isActive || studentsForGroup(group.id).length > 0
  );

  const rosterBuckets = [
    ...rosterGroups.map((group) => ({
      id: group.id,
      groupId: group.id,
      label: localName(group.nameEn, group.nameAr)
    })),
    {
      id: 'ungrouped',
      groupId: null,
      label: t('ungrouped')
    }
  ];

  return (
    <Card className="record-card">
      <div className="section-heading">
        <div>
          <h2>
            {localName(subjectNameEn, subjectNameAr)}
            {' · '}
            {localName(classNameEn, classNameAr)}
          </h2>
          <p className="muted-text">{t('teacherGroupHelp')}</p>
        </div>
      </div>

      <section className="subsection teacher-group-roster">
        <h3>{t('student')}</h3>

        {management.students.length === 0 ? (
          <p className="empty-state">{t('noStudents')}</p>
        ) : (
          <div className="stack">
            {rosterBuckets.map((bucket) => {
              const students = studentsForGroup(bucket.groupId);

              return (
                <section
                  className="record-card compact-card"
                  key={bucket.id}
                >
                  <div className="section-heading">
                    <h4>{bucket.label}</h4>
                  </div>

                  {students.length === 0 ? (
                    <p className="empty-state">{t('noStudents')}</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('student')}</th>
                            <th>{common('actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => {
                            const destinationGroups = activeGroups.filter(
                              (group) => group.id !== student.currentGroupId
                            );

                            return (
                              <tr key={student.id}>
                                <td>
                                  {localName(student.nameEn, student.nameAr)}
                                </td>
                                <td>
                                  <div className="stack">
                                    {destinationGroups.length > 0 ? (
                                      <form
                                        action={
                                          moveTeacherSubjectGroupStudentAction
                                        }
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
                                            defaultValue=""
                                            name="subjectGroupId"
                                            required
                                          >
                                            <option disabled value="">
                                              {t('moveToGroup')}
                                            </option>
                                            {destinationGroups.map((group) => (
                                              <option
                                                key={group.id}
                                                value={group.id}
                                              >
                                                {localName(
                                                  group.nameEn,
                                                  group.nameAr
                                                )}
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

                                        <Button
                                          type="submit"
                                          variant="secondary"
                                        >
                                          {t('moveToGroup')}
                                        </Button>
                                      </form>
                                    ) : null}

                                    {student.currentGroupId ? (
                                      <form
                                        action={
                                          removeTeacherSubjectGroupStudentAction
                                        }
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
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>

      <details className="teacher-group-management teacher-group-settings">
        <summary>{t('groups')}</summary>
        <div className="stack teacher-group-management-content">
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
        </div>
      </details>

      <details className="teacher-group-management teacher-group-history">
        <summary>{t('membershipHistory')}</summary>
        <div className="teacher-group-management-content">
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
        </div>
      </details>
    </Card>
  );
}
