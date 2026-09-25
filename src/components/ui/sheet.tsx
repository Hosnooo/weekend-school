import type {MouseEvent, ReactElement, ReactNode} from 'react';

import {Dialog, DialogClose} from '@/components/ui/dialog';

export function Sheet({
  trigger,
  title,
  children
}: {
  trigger: ReactElement<{onClick?: (event: MouseEvent<HTMLElement>) => void}>;
  title: string;
  children: ReactNode;
}) {
  return <Dialog contentClassName="sheet-content" title={title} trigger={trigger}>{children}</Dialog>;
}

export const SheetClose = DialogClose;
