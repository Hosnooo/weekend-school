'use client';

import {type MouseEvent, type ReactElement, useState} from 'react';

import {Dialog, DialogClose, useDialogClose} from '@/components/ui/dialog';

function ConfirmationAction({label, onConfirm}: {label: string; onConfirm: () => void | Promise<void>}) {
  const close = useDialogClose();
  const [pending, setPending] = useState(false);

  return (
    <button
      className="button button-secondary button-default button-danger"
      disabled={pending}
      onClick={async () => {
        if (pending) return;
        setPending(true);
        let completed = false;
        try {
          await onConfirm();
          completed = true;
        } finally {
          setPending(false);
        }
        if (completed) close?.();
      }}
      type="button"
    >
      {label}
    </button>
  );
}

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
  onConfirm: () => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open} title={title} trigger={trigger}>
      <p className="dialog-description">{description}</p>
      <div className="dialog-actions">
        <DialogClose>{cancelLabel}</DialogClose>
        <ConfirmationAction label={confirmLabel} onConfirm={onConfirm} />
      </div>
    </Dialog>
  );
}
