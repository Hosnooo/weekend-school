import type {HTMLAttributes, ReactNode} from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  children: ReactNode;
};

export function Alert({variant = 'info', className = '', children, ...props}: AlertProps) {
  return (
    <div
      className={`alert alert-${variant} ${className}`.trim()}
      role={variant === 'danger' ? 'alert' : 'status'}
      {...props}
    >
      {children}
    </div>
  );
}
