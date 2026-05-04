'use client';

import { useEffect, useRef, Fragment } from 'react';

function WorkerInitializerInner() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (typeof window === 'undefined') return;
    initialized.current = true;

    const initWorker = async () => {
      try {
        const response = await fetch('/api/internal/init-worker', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        if (data.status === 'success' || data.status === 'already_initialized') {
          console.log('[WorkerInitializer] Campaign worker ready');
        }
      } catch {
        console.warn('[WorkerInitializer] Could not initialize worker');
      }
    };

    const timer = setTimeout(initWorker, 1000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}

export function WorkerInitializer() {
  return <Fragment><WorkerInitializerInner /></Fragment>;
}
