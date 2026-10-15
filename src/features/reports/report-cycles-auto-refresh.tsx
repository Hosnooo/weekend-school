'use client';

import {useEffect} from 'react';

import {useRouter} from '@/i18n/navigation';

/** Update the Admin Reports list while it is open; never reload an editor. */
export function ReportCyclesAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const interval = window.setInterval(refreshIfVisible, 60_000);
    window.addEventListener('focus', refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [router]);

  return null;
}
