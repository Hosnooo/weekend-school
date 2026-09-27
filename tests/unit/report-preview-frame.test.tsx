import {render} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {ReportPreviewFrame} from '@/features/reports/report-preview-frame';

describe('ReportPreviewFrame', () => {
  it('does not crash when the iframe document root disappears during resize', () => {
    const originalResizeObserver = globalThis.ResizeObserver;

    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    globalThis.ResizeObserver =
      ResizeObserverStub as unknown as typeof ResizeObserver;

    const original = Object.getOwnPropertyDescriptor(
      HTMLIFrameElement.prototype,
      'contentDocument'
    );

    Object.defineProperty(
      HTMLIFrameElement.prototype,
      'contentDocument',
      {
        configurable: true,
        get: () => ({
          body: null,
          documentElement: null
        })
      }
    );

    let unmount: (() => void) | undefined;

    try {
      expect(() => {
        ({unmount} = render(
          <ReportPreviewFrame
            html="<p>Preview</p>"
            title="Report preview"
          />
        ));
      }).not.toThrow();

      unmount?.();
      unmount = undefined;
    } finally {
      unmount?.();
      globalThis.ResizeObserver = originalResizeObserver;

      if (original) {
        Object.defineProperty(
          HTMLIFrameElement.prototype,
          'contentDocument',
          original
        );
      } else {
        delete (
          HTMLIFrameElement.prototype as unknown as {
            contentDocument?: Document | null;
          }
        ).contentDocument;
      }
    }
  });
});
