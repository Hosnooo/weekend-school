'use client';

import {
  createContext,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import {createPortal} from 'react-dom';

const MenuContext = createContext<(() => void) | null>(null);
const menuGap = 6;
const viewportEdge = 8;

type MenuPosition = {
  top: number;
  left?: number;
  right?: number;
};

function getMenuPosition(trigger: HTMLElement, menuHeight = 0): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const direction = getComputedStyle(trigger).direction;
  const openBelow = rect.bottom + menuGap + menuHeight <= window.innerHeight - viewportEdge;
  const top = openBelow
    ? rect.bottom + menuGap
    : Math.max(viewportEdge, rect.top - menuGap - menuHeight);

  if (direction === 'rtl') {
    return {top, right: Math.max(viewportEdge, window.innerWidth - rect.right)};
  }

  return {top, right: Math.max(viewportEdge, window.innerWidth - rect.right)};
}

export function DropdownMenu({label, children}: {label: string; children: ReactNode}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function close({restoreFocus = true}: {restoreFocus?: boolean} = {}) {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus());
  }

  function openMenu() {
    if (triggerRef.current) setPosition(getMenuPosition(triggerRef.current));
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    setPosition(getMenuPosition(triggerRef.current, menuRef.current.getBoundingClientRect().height));
    menuRef.current.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function reposition() {
      if (!triggerRef.current || !menuRef.current) return;
      setPosition(getMenuPosition(triggerRef.current, menuRef.current.getBoundingClientRect().height));
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close({restoreFocus: false});
    }

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

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

  const menuStyle: CSSProperties | undefined = position
    ? {top: position.top, left: position.left, right: position.right}
    : undefined;

  return (
    <div className="dropdown-menu">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="button button-ghost button-icon"
        onClick={() => (open ? close({restoreFocus: false}) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openMenu();
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true">•••</span>
      </button>
      {open && position && typeof document !== 'undefined'
        ? createPortal(
            <MenuContext.Provider value={() => close({restoreFocus: false})}>
              <div
                className="dropdown-menu-content"
                onKeyDown={handleMenuKeyDown}
                ref={menuRef}
                role="menu"
                style={menuStyle}
              >
                {children}
              </div>
            </MenuContext.Provider>,
            document.body
          )
        : null}
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
