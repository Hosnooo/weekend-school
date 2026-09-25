import type {HTMLAttributes} from 'react';

import {Badge} from '@/components/ui/badge';

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  status: 'active' | 'inactive';
};

export function StatusBadge({className = '', status, ...props}: StatusBadgeProps) {
  return (
    <Badge
      className={`status-badge status-${status} ${className}`.trim()}
      variant={status === 'active' ? 'success' : 'warning'}
      {...props}
    />
  );
}
