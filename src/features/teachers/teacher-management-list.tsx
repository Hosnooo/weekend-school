'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

import {archiveManagedEntityAction} from '@/features/archives/archive.actions';
import {Badge} from '@/components/ui/badge';
import {ConfirmationDialog} from '@/components/ui/confirmation-dialog';
import {DataTable, type DataTableColumn} from '@/components/ui/data-table';
import {DropdownMenu, DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {EmptyState} from '@/components/ui/empty-state';
import {StatusBadge} from '@/components/ui/status-badge';
import {setTeacherActiveAction} from '@/features/teachers/teacher.actions';
import type {TeacherListItem} from '@/features/teachers/teacher.types';
import type {Locale} from '@/i18n/config';
import {useRouter} from '@/i18n/navigation';

type AccessState = 'signedIn' | 'linkSent' | 'unknown';

export function TeacherManagementList({
  locale,
  teachers,
  accessStates
}: {
  locale: Locale;
  teachers: TeacherListItem[];
  accessStates: Record<string, AccessState>;
}) {
  const t = useTranslations('teachers');
  const common = useTranslations('common');
  const language = useTranslations('language');
  const router = useRouter();
  const [lifecycleTarget, setLifecycleTarget] = useState<TeacherListItem | null>(null);

  if (teachers.length === 0) {
    return <EmptyState title={t('empty')} description={t('emptyHelp')} />;
  }

  function loginState(teacher: TeacherListItem) {
    if (!teacher.authUserId) return t('noAccountLinked');
    return t(accessStates[teacher.id] ?? 'unknown');
  }

  async function applyLifecycle() {
    if (!lifecycleTarget) return;
    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('id', lifecycleTarget.id);
    if (lifecycleTarget.isActive) {
      formData.set('entityType', 'TEACHER');
      await archiveManagedEntityAction(formData);
    } else {
      formData.set('isActive', 'true');
      await setTeacherActiveAction(formData);
    }
    router.refresh();
  }

  const columns: DataTableColumn<TeacherListItem>[] = [
    {
      key: 'teacher',
      header: t('name'),
      render: (teacher) => (
        <div>
          <strong>{teacher.displayName}</strong>
          <div>{teacher.email ?? common('none')}</div>
          <div>{language(teacher.preferredLanguage === 'ar' ? 'arabic' : 'english')}</div>
        </div>
      )
    },
    {
      key: 'status',
      header: common('status'),
      render: (teacher) => (
        <StatusBadge status={teacher.isActive ? 'active' : 'inactive'}>
          {teacher.isActive ? common('active') : common('inactive')}
        </StatusBadge>
      )
    },
    {
      key: 'login',
      header: t('loginAccess'),
      render: (teacher) => (
        <div>
          <div>{loginState(teacher)}</div>
          {teacher.assignmentCount > 0 && !teacher.authUserId ? (
            <Badge variant="warning">{t('coverageWithoutLogin')}</Badge>
          ) : null}
        </div>
      )
    },
    {
      key: 'coverage',
      header: t('teachingCoverage'),
      render: (teacher) => t('activeAssignments', {count: teacher.assignmentCount})
    },
    {
      key: 'actions',
      header: common('actions'),
      render: (teacher) => (
        <DropdownMenu label={t('teacherActions', {name: teacher.displayName})}>
          <DropdownMenuItem onSelect={() => router.push(`/teachers/${teacher.id}`)}>
            {t('viewTeacher')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/teachers/${teacher.id}/edit`)}>
            {common('edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/teachers/${teacher.id}/access`)}>
            {t('manageLoginAccess')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/teachers/${teacher.id}/assignments`)}>
            {t('assignments')}
          </DropdownMenuItem>
          <DropdownMenuItem destructive={teacher.isActive} onSelect={() => setLifecycleTarget(teacher)}>
            {teacher.isActive ? t('archiveTeacher') : common('reactivate')}
          </DropdownMenuItem>
        </DropdownMenu>
      )
    }
  ];

  return (
    <>
      <DataTable
        caption={t('listCaption')}
        columns={columns}
        getRowKey={(teacher) => teacher.id}
        rows={teachers}
      />
      <ConfirmationDialog
        cancelLabel={common('cancel')}
        confirmLabel={lifecycleTarget?.isActive ? t('archiveTeacher') : common('reactivate')}
        description={lifecycleTarget?.isActive ? t('archiveTeacherConfirm') : t('reactivateTeacherConfirm')}
        onConfirm={applyLifecycle}
        onOpenChange={(open) => {
          if (!open) setLifecycleTarget(null);
        }}
        open={lifecycleTarget !== null}
        title={lifecycleTarget?.isActive ? t('archiveTeacher') : common('reactivate')}
      />
    </>
  );
}
