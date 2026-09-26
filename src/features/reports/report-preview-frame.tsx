'use client';

import {useEffect, useRef} from 'react';

export function ReportPreviewFrame({
  html,
  title
}: {
  html: string;
  title: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let observer: ResizeObserver | null = null;
    let animationFrame = 0;

    const resize = () => {
      const document = frame.contentDocument;
      if (!document) return;

      const body = document.body;
      const root = document.documentElement;

      const height = Math.max(
        body?.scrollHeight ?? 0,
        body?.offsetHeight ?? 0,
        root.scrollHeight,
        root.offsetHeight
      );

      if (height > 0) {
        frame.style.height = `${height}px`;
      }
    };

    const connect = () => {
      observer?.disconnect();

      resize();

      const body = frame.contentDocument?.body;
      if (body) {
        observer = new ResizeObserver(resize);
        observer.observe(body);
      }

      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(resize);
    };

    frame.addEventListener('load', connect);

    // Also run after hydration in case the iframe loaded before
    // the load listener was attached.
    connect();

    return () => {
      frame.removeEventListener('load', connect);
      observer?.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [html]);

  return (
    <iframe
      ref={frameRef}
      className="report-preview"
      sandbox="allow-same-origin"
      srcDoc={html}
      title={title}
    />
  );
}
