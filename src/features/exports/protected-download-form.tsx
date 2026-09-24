'use client';

import type {FormEvent, ReactNode} from 'react';
import {useTransition} from 'react';

export type ProtectedDownloadAction = (formData: FormData) => Promise<string>;

export function ProtectedDownloadForm({
  action,
  className,
  children
}: {
  action?: ProtectedDownloadAction;
  className?: string;
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!action) return;
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const href = await action(formData);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    });
  }

  return <form aria-busy={pending || undefined} className={className} onSubmit={action ? submit : undefined}>{children}</form>;
}
