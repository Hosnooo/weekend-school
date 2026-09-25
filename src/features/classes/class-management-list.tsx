'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

import {ConfirmationDialog} from '@/components/ui/confirmation-dialog';
import {DataTable, type DataTableColumn} from '@/components/ui/data-table';
import {DropdownMenu, DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {StatusBadge} from '@/components/ui/status-badge';
import {setClassActiveAction} from '@/features/classes/class.actions';
import type {ClassSummary} from '@/features/classes/class.types';
import type {Locale} from '@/i18n/config';
import {Link, useRouter} from '@/i18n/navigation';

export function ClassManagementList({
  locale,
  classes
}: {
  locale: Locale;
  classes: ClassSummary[];
}) {
  const t = useTranslations('classes');
  const common = useTranslations('common');
  const router = useRouter();
  const [lifecycleTarget, setLifecycleTarget] = useState<ClassSummary | null>(null);

  const className = (item: ClassSummary) =>
    locale === 'ar' && item.nameAr ? item.nameAr : item.nameEn;

  async function applyLifecycle() {
    if (!lifecycleTarget) return;

    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('classId', lifecycleTarget.id);
    formData.set('isActive', String(!lifecycleTarget.isActive));

    await setClassActiveAction(formData);
    router.refresh();
  }

  const columns: DataTableColumn<ClassSummary>[] = [
    {
      key: 'class',
      header: t('name'),
      render: (item) => (
        <Link href={`/classes/${item.id}`}>
          <strong>{className(item)}</strong>
        </Link>
      )
    },
    {
      key: 'students',
      header: t('activeStudents'),
      render: (item) => item.activeStudentCount
    },
    {
      key: 'subjects',
      header: t('subjects'),
      render: (item) => item.subjectCount
    },
    {
      key: 'status',
      header: common('status'),
      render: (item) => (
        <StatusBadge status={item.isActive ? 'active' : 'inactive'}>
          {item.isActive ? common('active') : common('inactive')}
        </StatusBadge>
      )
    },
    {
      key: 'actions',
      header: common('actions'),
      render: (item) => (
        <DropdownMenu label={t('classActions', {name: className(item)})}>
          <DropdownMenuItem onSelect={() => router.push(`/classes/${item.id}`)}>
            {t('viewClass')}
          </DropdownMenuItem>
          <DropdownMenuItem
            destructive={item.isActive}
            onSelect={() => setLifecycleTarget(item)}
          >
            {item.isActive ? t('archive') : t('restore')}
          </DropdownMenuItem>
        </DropdownMenu>
      )
    }
  ];

  return (
    <>
      <DataTable
        caption={t('title')}
        columns={columns}
        getRowKey={(item) => item.id}
        rows={classes}
      />

      <ConfirmationDialog
        cancelLabel={common('cancel')}
        confirmLabel={lifecycleTarget?.isActive ? t('archive') : t('restore')}
        description={
          lifecycleTarget
            ? lifecycleTarget.isActive
              ? t('archiveClassConfirm', {name: className(lifecycleTarget)})
              : t('restoreClassConfirm', {name: className(lifecycleTarget)})
            : ''
        }
        onConfirm={applyLifecycle}
        onOpenChange={(open) => {
          if (!open) setLifecycleTarget(null);
        }}
        open={lifecycleTarget !== null}
        title={lifecycleTarget?.isActive ? t('archive') : t('restore')}
      />
    </>
  );
}
