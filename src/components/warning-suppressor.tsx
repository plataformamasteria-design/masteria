'use client';

import { useEffect } from 'react';

export function WarningSuppressor() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const originalWarn = console.warn;

    const suppressedWarnPatterns = [
      'findDOMNode is deprecated',
      'InnerScrollAndFocusHandler',
    ];

    const shouldSuppressWarn = (args: unknown[]) => {
      const message = args.map(arg => String(arg)).join(' ');
      return suppressedWarnPatterns.some(pattern => message.includes(pattern));
    };

    console.warn = (...args: unknown[]) => {
      if (!shouldSuppressWarn(args)) {
        originalWarn.apply(console, args);
      }
    };

    return () => {
      console.warn = originalWarn;
    };
  }, []);

  return null;
}
