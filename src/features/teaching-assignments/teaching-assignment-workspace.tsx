'use client';

import {type FormEvent, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

import {Alert} from '@/components/ui/alert';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {ConfirmationDialog} from '@/components/ui/confirmation-dialog';
import {DataTable, type DataTableColumn} from '@/components/ui/data-table';
import {Dialog, DialogClose} from '@/components/ui/dialog';
import {DropdownMenu, DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {EmptyState} from '@/components/ui/empty-state';
import {PageHeader} from '@/components/ui/page-header';
import {Tabs} from '@/components/ui/tabs';
import {
  createTeachingAssignmentMutationAction,
  deleteTeachingAssignmentAction,
  updateTeachingAssignmentMutationAction
} from '@/features/teaching-assignments/teaching-assignment.actions';
import {classifyTeachingAssignments} from '@/features/teaching-assignments/teaching-assignment.service';
import type {
  TeachingAssignment,
  TeachingAssignmentMutationError,
  TeachingAssignmentMutationResult,
  TeachingClassSubject
} from '@/features/teaching-assignments/teaching-assignment.types';
import type {Locale} from '@/i18n/config';
import {Link} from '@/i18n/navigation';

type ConfirmationTarget = {
  kind: 'end' | 'delete';
  assignment: TeachingAssignment;
};

function addMutationFields(
  formData: FormData,
  locale: Locale,
  teacherId: string,
  assignmentId?: string
) {
  formData.set('locale', locale);
  formData.set('teacherId', teacherId);
  if (assignmentId) formData.set('assignmentId', assignmentId);
  return formData;
}

export function TeachingAssignmentWorkspace({
  locale,
  teacherId,
  classSubjects,
  assignments,
  today,
  title,
  backHref,
  backLabel
}: {
  locale: Locale;
  teacherId: string;
  classSubjects: TeachingClassSubject[];
  assignments: TeachingAssignment[];
  today: string;
  title?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const t = useTranslations('teachers');
  const common = useTranslations('common');
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationTarget | null>(null);
  const [mutationError, setMutationError] = useState<TeachingAssignmentMutationError | null>(null);
  const [pending, setPending] = useState(false);

  const classes = useMemo(() => {
    const map = new Map<string, {id: string; nameEn: string; nameAr: string | null}>();
    for (const item of classSubjects) {
      const id = item.classId ?? item.classNameEn;
      if (!map.has(id)) map.set(id, {id, nameEn: item.classNameEn, nameAr: item.classNameAr});
    }
    return [...map.values()];
  }, [classSubjects]);
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const initialSubjectId = classSubjects.find(
    (item) => (item.classId ?? item.classNameEn) === (classes[0]?.id ?? '')
  )?.id ?? '';
  const [classSubjectId, setClassSubjectId] = useState(initialSubjectId);
  const [subjectGroupId, setSubjectGroupId] = useState('');

  const subjectsForClass = classSubjects.filter(
    (item) => (item.classId ?? item.classNameEn) === classId
  );
  const selectedSubject = subjectsForClass.find((item) => item.id === classSubjectId)
    ?? subjectsForClass[0]
    ?? null;
  const classified = classifyTeachingAssignments(assignments, today);

  const localName = (english: string, arabic: string | null) =>
    locale === 'ar' && arabic ? arabic : english;

  function subjectFor(assignment: TeachingAssignment) {
    return classSubjects.find((item) => item.id === assignment.classSubjectId) ?? null;
  }

  function scopeFor(assignment: TeachingAssignment) {
    const subject = subjectFor(assignment);
    if (!subject) return common('notAssigned');
    if (assignment.subjectGroupId === null) return t('entireSubject');
    const group = subject.groups.find((item) => item.id === assignment.subjectGroupId);
    return group ? localName(group.nameEn, group.nameAr) : common('notAssigned');
  }

  function contextFor(assignment: TeachingAssignment) {
    const subject = subjectFor(assignment);
    if (!subject) return common('notAssigned');
    return `${localName(subject.classNameEn, subject.classNameAr)} · ${localName(subject.subjectNameEn, subject.subjectNameAr)} · ${scopeFor(assignment)}`;
  }

  function chooseClass(nextClassId: string) {
    setClassId(nextClassId);
    const nextSubject = classSubjects.find(
      (item) => (item.classId ?? item.classNameEn) === nextClassId
    )?.id ?? '';
    setClassSubjectId(nextSubject);
    setSubjectGroupId('');
  }

  function messageFor(error: TeachingAssignmentMutationError) {
    switch (error) {
      case 'validation': return t('assignmentErrors.validation');
      case 'invalid-range': return t('assignmentErrors.invalidRange');
      case 'overlap': return t('assignmentErrors.overlap');
      case 'protected-history': return t('assignmentErrors.protectedHistory');
      case 'not-found': return t('assignmentErrors.notFound');
      case 'forbidden': return t('assignmentErrors.forbidden');
      case 'unexpected': return t('assignmentErrors.unexpected');
    }
  }

  async function performMutation(
    mutation: () => Promise<TeachingAssignmentMutationResult>,
    onSuccess: () => void
  ) {
    setMutationError(null);
    setPending(true);
    try {
      const result = await mutation();
      if (result.ok) onSuccess();
      else setMutationError(result.error);
    } finally {
      setPending(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = addMutationFields(new FormData(event.currentTarget), locale, teacherId);
    await performMutation(
      () => createTeachingAssignmentMutationAction(formData),
      () => {
        setAddOpen(false);
        setSubjectGroupId('');
      }
    );
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>, assignment: TeachingAssignment) {
    event.preventDefault();
    const formData = addMutationFields(new FormData(event.currentTarget), locale, teacherId, assignment.id);
    await performMutation(
      () => updateTeachingAssignmentMutationAction(formData),
      () => setEditingId(null)
    );
  }

  async function handleConfirmation(target: ConfirmationTarget) {
    if (target.kind === 'delete') {
      const formData = addMutationFields(new FormData(), locale, teacherId, target.assignment.id);
      await performMutation(() => deleteTeachingAssignmentAction(formData), () => undefined);
      return;
    }

    const formData = addMutationFields(new FormData(), locale, teacherId, target.assignment.id);
    formData.set('startsOn', target.assignment.startsOn);
    formData.set('endsOn', today);
    await performMutation(() => updateTeachingAssignmentMutationAction(formData), () => undefined);
  }

  function assignmentRows(rows: TeachingAssignment[], status: 'current' | 'upcoming' | 'past') {
    if (rows.length === 0) {
      return <EmptyState description={t(`emptyAssignments.${status}`)} title={t('noAssignments')} />;
    }

    const columns: DataTableColumn<TeachingAssignment>[] = [
      {
        key: 'context',
        header: t('teachingContext'),
        render: (assignment) => {
          const subject = subjectFor(assignment);
          return subject ? (
            <div>
              <strong>{localName(subject.classNameEn, subject.classNameAr)} · {localName(subject.subjectNameEn, subject.subjectNameAr)}</strong>
              <div>{scopeFor(assignment)}</div>
            </div>
          ) : common('notAssigned');
        }
      },
      {
        key: 'dates',
        header: t('assignmentDates'),
        render: (assignment) => editingId === assignment.id ? (
          <form className="form-grid compact-form" onSubmit={(event) => void handleUpdate(event, assignment)}>
            <label>
              {t('startsOn')}
              <input defaultValue={assignment.startsOn} name="startsOn" required type="date" />
            </label>
            <label>
              {t('endsOnOptional')}
              <input defaultValue={assignment.endsOn ?? ''} name="endsOn" type="date" />
            </label>
            <div className="form-actions">
              <Button disabled={pending} type="submit" variant="secondary">{pending ? common('saving') : t('saveDates')}</Button>
              <Button onClick={() => setEditingId(null)} type="button" variant="ghost">{common('cancel')}</Button>
            </div>
          </form>
        ) : (
          <span>{assignment.startsOn} — {assignment.endsOn ?? t('ongoing')}</span>
        )
      },
      {
        key: 'status',
        header: common('status'),
        render: () => (
          <Badge variant={status === 'current' ? 'success' : status === 'upcoming' ? 'info' : 'neutral'}>
            {t(`assignmentStatus.${status}`)}
          </Badge>
        )
      },
      {
        key: 'actions',
        header: common('actions'),
        render: (assignment) => (
          <DropdownMenu label={t('assignmentActions', {context: contextFor(assignment)})}>
            <DropdownMenuItem onSelect={() => {
              setMutationError(null);
              setEditingId(assignment.id);
            }}>
              {t('editDates')}
            </DropdownMenuItem>
            {status === 'current' ? (
              <DropdownMenuItem onSelect={() => {
                setMutationError(null);
                setConfirmation({kind: 'end', assignment});
              }}>
                {t('endAssignment')}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem destructive onSelect={() => {
              setMutationError(null);
              setConfirmation({kind: 'delete', assignment});
            }}>
              {t('deleteAssignment')}
            </DropdownMenuItem>
          </DropdownMenu>
        )
      }
    ];

    return (
      <DataTable
        caption={t(`assignmentStatus.${status}`)}
        columns={columns}
        getRowKey={(assignment) => assignment.id}
        rows={rows}
      />
    );
  }

  const addDialog = (
    <Dialog
      onOpenChange={setAddOpen}
      open={addOpen}
      title={t('addAssignment')}
      trigger={<Button disabled={classSubjects.length === 0}>{t('addAssignment')}</Button>}
    >
      {classSubjects.length === 0 ? (
        <EmptyState title={t('noTeachingContexts')} />
      ) : (
        <form className="record-form" onSubmit={(event) => void handleCreate(event)}>
          <p className="form-hint">{t('assignmentHistoryHelp')}</p>
          <div className="form-grid">
            <label>
              {t('class')}
              <select autoFocus onChange={(event) => chooseClass(event.target.value)} value={classId}>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>{localName(item.nameEn, item.nameAr)}</option>
                ))}
              </select>
            </label>
            <label>
              {t('subject')}
              <select
                name="classSubjectId"
                onChange={(event) => {
                  setClassSubjectId(event.target.value);
                  setSubjectGroupId('');
                }}
                value={selectedSubject?.id ?? ''}
              >
                {subjectsForClass.map((subject) => (
                  <option key={subject.id} value={subject.id}>{localName(subject.subjectNameEn, subject.subjectNameAr)}</option>
                ))}
              </select>
            </label>
            <label>
              {t('scope')}
              <select name="subjectGroupId" onChange={(event) => setSubjectGroupId(event.target.value)} value={subjectGroupId}>
                <option value="">{t('entireSubject')}</option>
                {selectedSubject?.groups.map((group) => (
                  <option key={group.id} value={group.id}>{localName(group.nameEn, group.nameAr)}</option>
                ))}
              </select>
            </label>
            <label>
              {t('startsOn')}
              <input defaultValue={today} name="startsOn" required type="date" />
            </label>
            <label>
              {t('endsOnOptional')}
              <input name="endsOn" type="date" />
            </label>
          </div>
          <div className="form-actions">
            <Button disabled={pending || !selectedSubject} type="submit">{pending ? common('saving') : t('addAssignment')}</Button>
            <DialogClose>{common('cancel')}</DialogClose>
          </div>
        </form>
      )}
    </Dialog>
  );

  return (
    <section className="admin-page assignment-workspace">
      <PageHeader
        actions={(
          <>
            {backHref && backLabel ? <Link className="button button-secondary action-link" href={backHref}>{backLabel}</Link> : null}
            {addDialog}
          </>
        )}
        description={t('assignmentHelp')}
        title={title ?? t('assignments')}
      />

      {mutationError ? <Alert key={mutationError} variant="danger">{messageFor(mutationError)}</Alert> : null}

      <Tabs
        label={t('assignmentViews')}
        items={[
          {value: 'current', label: t('assignmentStatus.current'), content: assignmentRows(classified.current, 'current')},
          {value: 'upcoming', label: t('assignmentStatus.upcoming'), content: assignmentRows(classified.upcoming, 'upcoming')},
          {value: 'past', label: t('assignmentStatus.past'), content: assignmentRows(classified.past, 'past')}
        ]}
      />

      <ConfirmationDialog
        cancelLabel={common('cancel')}
        confirmLabel={confirmation?.kind === 'delete' ? t('deleteAssignment') : t('endAssignment')}
        description={confirmation?.kind === 'delete' ? t('deleteAssignmentConfirm') : t('endAssignmentConfirm')}
        onConfirm={() => confirmation ? handleConfirmation(confirmation) : Promise.resolve()}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        open={confirmation !== null}
        title={confirmation?.kind === 'delete' ? t('deleteAssignment') : t('endAssignment')}
      />
    </section>
  );
}
