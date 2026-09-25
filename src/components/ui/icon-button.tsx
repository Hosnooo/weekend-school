import type {ButtonHTMLAttributes, ReactNode} from 'react';

import {Button} from '@/components/ui/button';

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'size'> & {
  label: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function IconButton({label, children, variant = 'ghost', ...props}: IconButtonProps) {
  return (
    <Button aria-label={label} size="icon" variant={variant} {...props}>
      <span aria-hidden="true">{children}</span>
    </Button>
  );
}
