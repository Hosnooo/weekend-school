'use client';

import {
  cloneElement,
  createContext,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState
} from 'react';

const DialogContext = createContext<(() => void) | null>(null);
const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  trigger,
  title,
  children
}: {
  trigger: ReactElement<{onClick?: (event: MouseEvent<HTMLElement>) => void}>;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  function close() {
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    const content = contentRef.current;
    const first = content?.querySelector<HTMLElement>(focusableSelector);
    first?.focus();
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(contentRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger, {
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        onClick: (event: MouseEvent<HTMLElement>) => {
          trigger.props.onClick?.(event);
          triggerRef.current = event.currentTarget;
          setOpen(true);
        }
      } as Record<string, unknown>)
    : trigger;

  return (
    <>
      {triggerElement}
      {open ? (
        <div className="dialog-backdrop" data-state="open">
          <DialogContext.Provider value={close}>
            <div
              aria-labelledby={titleId}
              aria-modal="true"
              className="dialog-content"
              onKeyDown={handleKeyDown}
              ref={contentRef}
              role="dialog"
            >
              <h2 className="dialog-title" id={titleId}>{title}</h2>
              {children}
            </div>
          </DialogContext.Provider>
        </div>
      ) : null}
    </>
  );
}

export function DialogClose({children}: {children: ReactNode}) {
  const close = useContext(DialogContext);
  return <button className="button button-secondary button-default" onClick={close ?? undefined} type="button">{children}</button>;
}
