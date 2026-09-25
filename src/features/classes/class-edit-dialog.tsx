'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

import {Button} from '@/components/ui/button';
import {Dialog, DialogClose} from '@/components/ui/dialog';
import {FormField} from '@/components/ui/form-field';
import {updateClassAction} from '@/features/classes/class.actions';
import type {Locale} from '@/i18n/config';
import {useRouter} from '@/i18n/navigation';

export function ClassEditDialog({
  locale,
  classId,
  nameEn,
  nameAr
}: {
  locale: Locale;
  classId: string;
  nameEn: string;
  nameAr: string | null;
}) {
  const t = useTranslations('classes');
  const common = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    try {
      await updateClassAction(formData);
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      onOpenChange={setOpen}
      open={open}
      title={t('editClass')}
      trigger={
        <Button type="button" variant="secondary">
          {t('editClass')}
        </Button>
      }
    >
      <form action={submit} className="record-form">
        <input name="locale" type="hidden" value={locale} />
        <input name="classId" type="hidden" value={classId} />

        <div className="form-grid">
          <FormField htmlFor="edit-class-name-en" label={t('nameEn')}>
            <input
              defaultValue={nameEn}
              id="edit-class-name-en"
              name="nameEn"
              required
            />
          </FormField>

          <FormField htmlFor="edit-class-name-ar" label={t('nameAr')}>
            <input
              defaultValue={nameAr ?? ''}
              dir="rtl"
              id="edit-class-name-ar"
              name="nameAr"
            />
          </FormField>
        </div>

        <div className="dialog-actions">
          <DialogClose>{common('cancel')}</DialogClose>
          <Button disabled={pending} type="submit">
            {pending ? common('saving') : common('save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
