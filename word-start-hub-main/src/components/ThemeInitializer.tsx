import { useLayoutEffect } from 'react';

/**
 * ThemeInitializer - Syncs theme across tabs.
 * Theme is only visually applied inside AppShell (scoped via .app-themed).
 * This component just ensures localStorage stays in sync across tabs.
 */
export function ThemeInitializer() {
  useLayoutEffect(() => {
    // Ensure no stale dark class on root from previous versions
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme') {
        // Dispatch a custom event so AppShell can react
        window.dispatchEvent(new CustomEvent('theme-changed'));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return null;
}
