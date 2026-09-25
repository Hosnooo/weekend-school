import type {ReactNode} from 'react';

import {Breadcrumbs, type BreadcrumbItem} from '@/components/ui/breadcrumbs';

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}) {
  return (
    <header className="page-header">
      <div className="page-header-main">
        {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
