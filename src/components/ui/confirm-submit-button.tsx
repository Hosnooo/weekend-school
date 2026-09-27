'use client';

import type {
  ButtonHTMLAttributes,
  MouseEvent
} from 'react';

export function ConfirmSubmitButton({
  confirmMessage,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmMessage: string;
}) {
  return (
    <button
      {...props}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }

        onClick?.(event);
      }}
    />
  );
}
