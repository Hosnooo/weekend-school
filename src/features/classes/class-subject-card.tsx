'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {ConfirmationDialog} from '@/components/ui/confirmation-dialog';
import {Dialog, DialogClose} from '@/components/ui/dialog';
import {DropdownMenu, DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {FormField} from '@/components/ui/form-field';
import {StatusBadge} from '@/components/ui/status-badge';
import {
  setDefaultGroupAction,
  setSubjectActiveAction,
  setSubjectGroupActiveAction,
  updateSubjectAction,
  updateSubjectGroupAction
} from '@/features/classes/class.actions';
import type {
  ClassSubjectSummary,
  SubjectGroupSummary
} from '@/features/classes/class.types';
import {SubjectGroupForm} from '@/features/classes/subject-group-form';
import type {Locale} from '@/i18n/config';
import {useRouter} from '@/i18n/navigation';

type LifecycleTarget =
  | {
      kind: 'subject';
      id: string;
      name: string;
      isActive: boolean;
    }
  | {
      kind: 'group';
      id: string;
      name: string;
      isActive: boolean;
    };

export function ClassSubjectCard({
  locale,
  classId,
  subject
}: {
  locale: Locale;
  classId: string;
  subject: ClassSubjectSummary;
}) {
  const t = useTranslations('classes');
  const common = useTranslations('common');
  const router = useRouter();

  const [subjectEditOpen, setSubjectEditOpen] = useState(false);
  const [groupEditTarget, setGroupEditTarget] =
    useState<SubjectGroupSummary | null>(null);
  const [lifecycleTarget, setLifecycleTarget] =
    useState<LifecycleTarget | null>(null);

  const subjectName =
    locale === 'ar' && subject.subjectNameAr
      ? subject.subjectNameAr
      : subject.subjectNameEn;

  const groupName = (group: SubjectGroupSummary) =>
    locale === 'ar' && group.nameAr ? group.nameAr : group.nameEn;

  async function updateSubject(formData: FormData) {
    await updateSubjectAction(formData);
    setSubjectEditOpen(false);
    router.refresh();
  }

  async function updateGroup(formData: FormData) {
    await updateSubjectGroupAction(formData);
    setGroupEditTarget(null);
    router.refresh();
  }

  async function applyDefaultGroup(groupId: string) {
    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('classId', classId);
    formData.set('classSubjectId', subject.id);
    formData.set('subjectGroupId', groupId);

    await setDefaultGroupAction(formData);
    router.refresh();
  }

  async function applyLifecycle() {
    if (!lifecycleTarget) return;

    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('classId', classId);
    formData.set('isActive', String(!lifecycleTarget.isActive));

    if (lifecycleTarget.kind === 'subject') {
      formData.set('subjectId', lifecycleTarget.id);
      await setSubjectActiveAction(formData);
    } else {
      formData.set('subjectGroupId', lifecycleTarget.id);
      await setSubjectGroupActiveAction(formData);
    }

    router.refresh();
  }

  const lifecycleDescription = lifecycleTarget
    ? lifecycleTarget.kind === 'subject'
      ? lifecycleTarget.isActive
        ? t('archiveSubjectConfirm', {name: lifecycleTarget.name})
        : t('restoreSubjectConfirm', {name: lifecycleTarget.name})
      : lifecycleTarget.isActive
        ? t('archiveGroupConfirm', {name: lifecycleTarget.name})
        : t('restoreGroupConfirm', {name: lifecycleTarget.name})
    : '';

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

        <div className="row-actions">
          <StatusBadge status={subject.isActive ? 'active' : 'inactive'}>
            {subject.isActive ? common('active') : common('inactive')}
          </StatusBadge>

          <DropdownMenu label={t('subjectActions', {name: subjectName})}>
            <DropdownMenuItem onSelect={() => setSubjectEditOpen(true)}>
              {t('editSubject')}
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() => router.push('/teaching-assignments')}
            >
              {t('manageTeachingAssignments')}
            </DropdownMenuItem>

            <DropdownMenuItem
              destructive={subject.isActive}
              onSelect={() =>
                setLifecycleTarget({
                  kind: 'subject',
                  id: subject.subjectId,
                  name: subjectName,
                  isActive: subject.isActive
                })
              }
            >
              {subject.isActive ? t('archive') : t('restore')}
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      </header>

      {subject.groups.length === 0 ? (
        <p className="empty-inline">{t('noGroups')}</p>
      ) : (
        <>
          <ul className="group-list">
            {subject.groups.map((group) => {
              const name = groupName(group);

              return (
                <li className="group-list-item" key={group.id}>
                  <span>
                    <strong>{name}</strong>

                    {group.isDefault ? (
                      <Badge variant="info">
                        {t('defaultGroup')}
                      </Badge>
                    ) : null}

                    <StatusBadge
                      status={group.isActive ? 'active' : 'inactive'}
                    >
                      {group.isActive
                        ? common('active')
                        : common('inactive')}
                    </StatusBadge>
                  </span>

                  <DropdownMenu label={t('groupActions', {name})}>
                    <DropdownMenuItem
                      onSelect={() => setGroupEditTarget(group)}
                    >
                      {t('editGroup')}
                    </DropdownMenuItem>

                    {!group.isDefault && group.isActive ? (
                      <DropdownMenuItem
                        onSelect={() => void applyDefaultGroup(group.id)}
                      >
                        {t('makeDefault')}
                      </DropdownMenuItem>
                    ) : null}

                    <DropdownMenuItem
                      destructive={group.isActive}
                      onSelect={() =>
                        setLifecycleTarget({
                          kind: 'group',
                          id: group.id,
                          name,
                          isActive: group.isActive
                        })
                      }
                    >
                      {group.isActive ? t('archive') : t('restore')}
                    </DropdownMenuItem>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>

          <p className="form-hint">{t('defaultGroupHelp')}</p>
        </>
      )}

      {subject.isActive ? (
        <Dialog
          title={t('addGroup')}
          trigger={
            <Button type="button" variant="secondary">
              {t('addGroup')}
            </Button>
          }
        >
          <SubjectGroupForm
            classId={classId}
            classSubjectId={subject.id}
            locale={locale}
          />

          <div className="dialog-actions">
            <DialogClose>{common('cancel')}</DialogClose>
          </div>
        </Dialog>
      ) : null}

      <Dialog
        onOpenChange={setSubjectEditOpen}
        open={subjectEditOpen}
        title={t('editSubject')}
      >
        <form action={updateSubject} className="record-form">
          <input name="locale" type="hidden" value={locale} />
          <input name="classId" type="hidden" value={classId} />
          <input name="subjectId" type="hidden" value={subject.subjectId} />

          <div className="form-grid">
            <FormField
              htmlFor={`subject-${subject.subjectId}-name-en`}
              label={t('subjectNameEn')}
            >
              <input
                defaultValue={subject.subjectNameEn}
                id={`subject-${subject.subjectId}-name-en`}
                name="nameEn"
                required
              />
            </FormField>

            <FormField
              htmlFor={`subject-${subject.subjectId}-name-ar`}
              label={t('subjectNameAr')}
            >
              <input
                defaultValue={subject.subjectNameAr ?? ''}
                dir="rtl"
                id={`subject-${subject.subjectId}-name-ar`}
                name="nameAr"
              />
            </FormField>
          </div>

          <div className="dialog-actions">
            <DialogClose>{common('cancel')}</DialogClose>
            <Button type="submit">{common('save')}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setGroupEditTarget(null);
        }}
        open={groupEditTarget !== null}
        title={t('editGroup')}
      >
        {groupEditTarget ? (
          <form action={updateGroup} className="record-form">
            <input name="locale" type="hidden" value={locale} />
            <input name="classId" type="hidden" value={classId} />
            <input
              name="subjectGroupId"
              type="hidden"
              value={groupEditTarget.id}
            />

            <div className="form-grid">
              <FormField
                htmlFor={`group-${groupEditTarget.id}-name-en`}
                label={t('groupNameEn')}
              >
                <input
                  defaultValue={groupEditTarget.nameEn}
                  id={`group-${groupEditTarget.id}-name-en`}
                  name="nameEn"
                  required
                />
              </FormField>

              <FormField
                htmlFor={`group-${groupEditTarget.id}-name-ar`}
                label={t('groupNameAr')}
              >
                <input
                  defaultValue={groupEditTarget.nameAr ?? ''}
                  dir="rtl"
                  id={`group-${groupEditTarget.id}-name-ar`}
                  name="nameAr"
                />
              </FormField>
            </div>

            <div className="dialog-actions">
              <DialogClose>{common('cancel')}</DialogClose>
              <Button type="submit">{common('save')}</Button>
            </div>
          </form>
        ) : null}
      </Dialog>

      <ConfirmationDialog
        cancelLabel={common('cancel')}
        confirmLabel={
          lifecycleTarget?.isActive ? t('archive') : t('restore')
        }
        description={lifecycleDescription}
        onConfirm={applyLifecycle}
        onOpenChange={(open) => {
          if (!open) setLifecycleTarget(null);
        }}
        open={lifecycleTarget !== null}
        title={lifecycleTarget?.isActive ? t('archive') : t('restore')}
      />
    </article>
  );
}
