'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

import {ConfirmationDialog} from '@/components/ui/confirmation-dialog';
import {DataTable, type DataTableColumn} from '@/components/ui/data-table';
import {DropdownMenu, DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {EmptyState} from '@/components/ui/empty-state';
import {StatusBadge} from '@/components/ui/status-badge';
import {archiveStudentAction} from '@/features/archives/archive.actions';
import type {StudentListItem} from '@/features/students/student.types';
import type {Locale} from '@/i18n/config';
import {Link, useRouter} from '@/i18n/navigation';

export function StudentManagementList({locale, students}: {locale: Locale; students: StudentListItem[]}) {
  const t = useTranslations('students');
  const common = useTranslations('common');
  const router = useRouter();
  const [archiveTarget, setArchiveTarget] = useState<StudentListItem | null>(null);

  const localName = (student: StudentListItem) =>
    locale === 'ar' && student.firstNameAr && student.lastNameAr
      ? `${student.firstNameAr} ${student.lastNameAr}`
      : `${student.firstNameEn} ${student.lastNameEn}`;

  const localClass = (student: StudentListItem) => student.currentClass
    ? locale === 'ar' && student.currentClass.nameAr
      ? student.currentClass.nameAr
      : student.currentClass.nameEn
    : common('notAssigned');

  if (students.length === 0) return <EmptyState title={t('empty')} />;

  async function archiveStudent() {
    if (!archiveTarget) return;
    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('id', archiveTarget.id);
    await archiveStudentAction(formData);
    router.refresh();
  }

  const columns: DataTableColumn<StudentListItem>[] = [
    {
      key: 'student',
      header: t('name'),
      render: (student) => (
        <Link href={`/students/${student.id}`}><strong>{localName(student)}</strong></Link>
      )
    },
    {
      key: 'class',
      header: t('class'),
      render: localClass
    },
    {
      key: 'status',
      header: common('status'),
      render: (student) => (
        <StatusBadge status={student.isActive ? 'active' : 'inactive'}>
          {student.isActive ? common('active') : common('inactive')}
        </StatusBadge>
      )
    },
    {
      key: 'actions',
      header: common('actions'),
      render: (student) => (
        <DropdownMenu label={`${common('actions')}: ${localName(student)}`}>
          <DropdownMenuItem onSelect={() => router.push(`/students/${student.id}/edit`)}>
            {common('edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/students/${student.id}/enrollment`)}>
            {t('manageEnrollment')}
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setArchiveTarget(student)}>
            {common('deactivate')}
          </DropdownMenuItem>
        </DropdownMenu>
      )
    }
  ];

  return (
    <>
      <DataTable caption={t('title')} columns={columns} getRowKey={(student) => student.id} rows={students} />
      <ConfirmationDialog
        cancelLabel={common('cancel')}
        confirmLabel={common('deactivate')}
        description={archiveTarget ? `${common('deactivate')} ${localName(archiveTarget)}?` : ''}
        onConfirm={archiveStudent}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        open={archiveTarget !== null}
        title={common('deactivate')}
      />
    </>
  );
}
