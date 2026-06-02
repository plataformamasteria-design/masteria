'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'masteriaPrefs';

/**
 * Aplica as preferências salvas no localStorage ao elemento <html>
 * para que o CSS de modo compacto e animações funcione em todas as páginas.
 */
export function PrefsApplier() {
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (saved.compactMode !== undefined) {
        document.documentElement.setAttribute('data-compact', String(saved.compactMode));
      }
      if (saved.animations !== undefined) {
        document.documentElement.setAttribute('data-animations', String(saved.animations));
      }
      if (saved.sidebar) {
        document.documentElement.setAttribute('data-sidebar', saved.sidebar);
      }
    } catch { /* noop */ }
  }, []);

  return null;
}
