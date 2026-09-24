import type {HTMLAttributes} from 'react';

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  status: 'active' | 'inactive';
};

export function StatusBadge({className = '', status, ...props}: StatusBadgeProps) {
  return (
    <span
      className={`status-badge status-${status} ${className}`.trim()}
      {...props}
    />
  );
}
