'use client';

import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import type {Locale} from '@/i18n/config';

import {resolveAttendanceConflictAction} from './attendance.actions';
import type {AttendanceConflict, OfficialAttendanceStatus} from './attendance.types';

function localizedName(en: string, ar: string | null, locale: Locale) {
  return locale === 'ar' && ar ? ar : en;
}

export function AttendanceConflictList({
  locale,
  conflicts
}: {
  locale: Locale;
  conflicts: AttendanceConflict[];
}) {
  const weekly = useTranslations('weekly');
  const attendanceConflicts = useTranslations('attendanceConflicts');

  const statusLabel = (status: OfficialAttendanceStatus) =>
    status === 'PRESENT'
      ? weekly('attendanceStatus.PRESENT')
      : weekly('attendanceStatus.ABSENT');

  const actionLabel = (status: OfficialAttendanceStatus) =>
    attendanceConflicts('useStatus', {status: statusLabel(status)});

  return (
    <div className="stack-list">
      {conflicts.map((conflict) => {
        const groupName = conflict.groupNameEn
          ? localizedName(conflict.groupNameEn, conflict.groupNameAr, locale)
          : null;

        return (
          <article
            className="record-card"
            key={`${conflict.classSubjectId}:${conflict.subjectGroupId ?? 'whole'}:${conflict.weekStart}:${conflict.studentId}`}
          >
            <div className="record-card-main">
              <h3>{localizedName(conflict.studentNameEn, conflict.studentNameAr, locale)}</h3>
              <p>
                {localizedName(conflict.subjectNameEn, conflict.subjectNameAr, locale)}
                {groupName ? ` · ${groupName}` : ''}
              </p>
              <ul>
                {conflict.observations.map((observation) => (
                  <li key={observation.teacherId}>
                    {observation.teacherName}: {statusLabel(observation.status)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="form-actions">
              {(['PRESENT', 'ABSENT'] as const).map((status) => (
                <form action={resolveAttendanceConflictAction} key={status}>
                  <input name="locale" type="hidden" value={locale} />
                  <input name="classSubjectId" type="hidden" value={conflict.classSubjectId} />
                  <input name="subjectGroupId" type="hidden" value={conflict.subjectGroupId ?? ''} />
                  <input name="weekStart" type="hidden" value={conflict.weekStart} />
                  <input name="studentId" type="hidden" value={conflict.studentId} />
                  <input name="status" type="hidden" value={status} />
                  <Button type="submit" variant={status === 'PRESENT' ? 'primary' : 'secondary'}>
                    {actionLabel(status)}
                  </Button>
                </form>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
