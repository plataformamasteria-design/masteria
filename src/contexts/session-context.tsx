
'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { UserWithCompany } from '@/lib/types';
import { FacebookLinkBanner } from '@/components/oauth/facebook-link-banner';
import { PageLayoutProvider, usePageLayout } from './page-layout-context';

interface Session {
  empresaId: string | null;
  userId: string | null;
  userData: UserWithCompany | null;
  accessToken: string | null;
}

interface SessionContextType {
  session: Session | null;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

function MainContentInner({ children }: { children: ReactNode }): JSX.Element {
  const { session } = useSession();
  const { layoutMode } = usePageLayout();
  const [mounted, setMounted] = useState(false);
  const userEmail = session?.userData?.email || '';
  const hasFacebookLinked = !!session?.userData?.facebookId;

  useEffect(() => {
    setMounted(true);
  }, []);

  const isFullHeight = layoutMode === 'full-height';

  const mainClasses = isFullHeight
    ? 'flex-1 min-h-0 overflow-hidden bg-background p-4 sm:p-6 md:p-8 flex flex-col'
    : 'flex-1 overflow-y-auto bg-background p-4 sm:p-6 md:p-8 pb-24 md:pb-8';

  const contentWrapperClasses = isFullHeight
    ? 'flex-1 min-h-0 w-full max-w-full overflow-hidden'
    : 'w-full max-w-full';

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      <main className={mainClasses}>
        {mounted && !hasFacebookLinked && userEmail && !isFullHeight && (
          <FacebookLinkBanner userEmail={userEmail} />
        )}
        <div className={contentWrapperClasses}>
          {children}
        </div>
      </main>
    </div>
  );
}

export function MainContent({ children }: { children: ReactNode }): JSX.Element {
  return (
    <PageLayoutProvider>
      <MainContentInner>{children}</MainContentInner>
    </PageLayoutProvider>
  );
}

// O provider agora é usado apenas para disponibilizar os dados da sessão, não para validação.
export function SessionProvider({ children, value }: { children: ReactNode, value: Session | null }): JSX.Element {
  return (
    <SessionContext.Provider value={{ session: value, loading: !value }}>
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession deve ser usado dentro de um SessionProvider');
  }
  return context;
};
