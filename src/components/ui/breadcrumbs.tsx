type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({items}: {items: BreadcrumbItem[]}) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs" dir="inherit">
      <ol>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {item.href && !isLast ? <a href={item.href}>{item.label}</a> : <span aria-current={isLast ? 'page' : undefined}>{item.label}</span>}
              {!isLast ? <span aria-hidden="true" className="breadcrumbs-separator">›</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type {BreadcrumbItem};
