'use client';

import {type KeyboardEvent, type ReactNode, useId, useState} from 'react';

type TabItem = {
  value: string;
  label: string;
  content: ReactNode;
};

export function Tabs({items, defaultValue}: {items: TabItem[]; defaultValue?: string}) {
  const baseId = useId();
  const initial = defaultValue && items.some((item) => item.value === defaultValue)
    ? defaultValue
    : items[0]?.value ?? '';
  const [active, setActive] = useState(initial);
  const activeItem = items.find((item) => item.value === active) ?? items[0];

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || items.length === 0) return;
    event.preventDefault();
    const index = items.findIndex((item) => item.value === active);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowRight'
          ? (index + 1) % items.length
          : (index - 1 + items.length) % items.length;
    setActive(items[nextIndex].value);
    requestAnimationFrame(() => document.getElementById(`${baseId}-tab-${items[nextIndex].value}`)?.focus());
  }

  if (!activeItem) return null;

  return (
    <div className="tabs">
      <div aria-label="Views" className="tabs-list" onKeyDown={handleKeyDown} role="tablist">
        {items.map((item) => {
          const selected = item.value === activeItem.value;
          return (
            <button
              aria-controls={`${baseId}-panel-${item.value}`}
              aria-selected={selected}
              className="tabs-trigger"
              id={`${baseId}-tab-${item.value}`}
              key={item.value}
              onClick={() => setActive(item.value)}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`${baseId}-tab-${activeItem.value}`}
        className="tabs-panel"
        id={`${baseId}-panel-${activeItem.value}`}
        role="tabpanel"
      >
        {activeItem.content}
      </div>
    </div>
  );
}

export type {TabItem};
