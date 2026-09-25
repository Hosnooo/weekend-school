import type {MouseEvent, ReactElement} from 'react';

import {Dialog, DialogClose} from '@/components/ui/dialog';

export function ConfirmationDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  open,
  onOpenChange
}: {
  trigger?: ReactElement<{onClick?: (event: MouseEvent<HTMLElement>) => void}>;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open} title={title} trigger={trigger}>
      <p className="dialog-description">{description}</p>
      <div className="dialog-actions">
        <DialogClose>{cancelLabel}</DialogClose>
        <DialogClose className="button-danger" onClick={onConfirm}>{confirmLabel}</DialogClose>
      </div>
    </Dialog>
  );
}
