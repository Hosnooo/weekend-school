import type {ReactNode} from 'react';

import {Breadcrumbs, type BreadcrumbItem} from '@/components/ui/breadcrumbs';

type PageHeaderBase = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

type PageHeaderProps = PageHeaderBase & (
  | {breadcrumbs?: undefined; breadcrumbLabel?: undefined}
  | {breadcrumbs: BreadcrumbItem[]; breadcrumbLabel: string}
);

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  breadcrumbLabel
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-main">
        {breadcrumbs?.length && breadcrumbLabel ? <Breadcrumbs items={breadcrumbs} label={breadcrumbLabel} /> : null}
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
