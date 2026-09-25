'use client';

import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';

const MenuContext = createContext<(() => void) | null>(null);

export function DropdownMenu({label, children}: {label: string; children: ReactNode}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  function close({restoreFocus = true}: {restoreFocus?: boolean} = {}) {
    setOpen(false);
    if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus());
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown' && items.length > 0) {
      event.preventDefault();
      items[(index + 1 + items.length) % items.length].focus();
    } else if (event.key === 'ArrowUp' && items.length > 0) {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length].focus();
    }
  }

  return (
    <div className="dropdown-menu">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="button button-ghost button-icon"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true">•••</span>
      </button>
      {open ? (
        <MenuContext.Provider value={() => close({restoreFocus: false})}>
          <div className="dropdown-menu-content" onKeyDown={handleMenuKeyDown} ref={menuRef} role="menu">
            {children}
          </div>
        </MenuContext.Provider>
      ) : null}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onSelect,
  destructive = false
}: {
  children: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
}) {
  const close = useContext(MenuContext);
  return (
    <button
      className={`dropdown-menu-item${destructive ? ' dropdown-menu-item-danger' : ''}`}
      onClick={() => {
        onSelect?.();
        close?.();
      }}
      role="menuitem"
      tabIndex={-1}
      type="button"
    >
      {children}
    </button>
  );
}
