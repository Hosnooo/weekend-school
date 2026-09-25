import type {HTMLAttributes} from 'react';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({variant = 'neutral', className = '', ...props}: BadgeProps) {
  return <span className={`badge badge-${variant} ${className}`.trim()} {...props} />;
}
