import { useEffect, useState, useCallback } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return 'light';
  });

  // Sync state mutations to localStorage and inform other instances
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (theme !== saved) {
      localStorage.setItem('theme', theme);
      window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
    }
  }, [theme]);

  // Listen to changes from other instances or tabs
  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail?.theme && e.detail.theme !== theme) {
        setTheme(e.detail.theme);
      } else if (!e.detail) {
        const saved = localStorage.getItem('theme') as 'light' | 'dark';
        if (saved && saved !== theme) {
          setTheme(saved);
        }
      }
    };

    window.addEventListener('theme-changed', handleThemeChange);
    return () => {
      window.removeEventListener('theme-changed', handleThemeChange);
    };
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggleTheme };
}
