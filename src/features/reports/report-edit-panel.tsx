'use client';

import {useEffect, useState, type ReactNode} from 'react';

/**
 * Hash links open draft editors immediately. A guarded server action can also
 * reopen a finalized, unsent report and select its editor via ?editor=.
 * Next.js can retain the hash without triggering :target after an RSC
 * navigation, so visibility must not depend on CSS :target alone.
 */
export function ReportEditPanel({
  children,
  id,
  openOnArrival = false
}: {
  children: ReactNode;
  id: string;
  openOnArrival?: boolean;
}) {
  const [open, setOpen] = useState(openOnArrival);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.slice(1);
      setOpen(hash === id || (openOnArrival && hash === ''));
    };

    if (openOnArrival) {
      // Some App Router server-action redirects keep the preceding hash.
      // Re-align the URL with the editor selected by the guarded action.
      setOpen(true);
      if (window.location.hash !== `#${id}`) {
        window.location.hash = id;
      }
    } else {
      syncFromHash();
    }
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [id, openOnArrival]);

  return (
    <div
      className="report-edit-panel report-source-editor"
      hidden={!open}
      id={id}
    >
      {children}
    </div>
  );
}
