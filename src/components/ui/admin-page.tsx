import type {ReactNode} from 'react';

import {Link} from '@/i18n/navigation';

export function AdminPage({
  title,
  description,
  actions,
  children
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-page">
      <header className="page-heading">
        <div><h1>{title}</h1><p>{description}</p></div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function ActionLink({href, children}: {href: string; children: ReactNode}) {
  return <Link className="button button-primary action-link" href={href}>{children}</Link>;
}

export function SecondaryLink({href, children}: {href: string; children: ReactNode}) {
  return <Link className="button button-secondary action-link" href={href}>{children}</Link>;
}
