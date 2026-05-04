'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type LayoutMode = 'default' | 'full-height';

interface PageLayoutContextType {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
}

const FULL_HEIGHT_ROUTES = ['/atendimentos'];

function getInitialLayoutMode(pathname: string): LayoutMode {
  return FULL_HEIGHT_ROUTES.some(route => pathname.startsWith(route)) ? 'full-height' : 'default';
}

const PageLayoutContext = createContext<PageLayoutContextType | undefined>(undefined);

export function PageLayoutProvider({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() => getInitialLayoutMode(pathname));

  useEffect(() => {
    setLayoutModeState(getInitialLayoutMode(pathname));
  }, [pathname]);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
  }, []);

  return (
    <PageLayoutContext.Provider value={{ layoutMode, setLayoutMode }}>
      {children}
    </PageLayoutContext.Provider>
  );
}

export function usePageLayout(): PageLayoutContextType {
  const context = useContext(PageLayoutContext);
  if (context === undefined) {
    throw new Error('usePageLayout deve ser usado dentro de um PageLayoutProvider');
  }
  return context;
}

export function useFullHeightLayout(): void {
}
