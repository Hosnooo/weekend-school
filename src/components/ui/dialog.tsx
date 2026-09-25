'use client';

import {
  cloneElement,
  createContext,
  isValidElement,
  type ButtonHTMLAttributes,
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
  children,
  contentClassName = ''
}: {
  trigger: ReactElement<{onClick?: (event: MouseEvent<HTMLElement>) => void}>;
  title: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [restoreFocusElement, setRestoreFocusElement] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    queueMicrotask(() => restoreFocusElement?.focus());
  }

  useEffect(() => {
    if (!open) return;
    contentRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
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
          setRestoreFocusElement(event.currentTarget);
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
              className={`dialog-content ${contentClassName}`.trim()}
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

export function useDialogClose() {
  return useContext(DialogContext);
}

export function DialogClose({className = '', onClick, children, ...props}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const close = useDialogClose();
  return (
    <button
      className={`button button-secondary button-default ${className}`.trim()}
      onClick={(event) => {
        onClick?.(event);
        close?.();
      }}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
