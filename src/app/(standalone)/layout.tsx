import { ThemeProvider } from '@/components/theme-provider';
import { SessionProvider } from '@/contexts/session-context';
import type { ReactNode } from 'react';
import { getUserSession } from '@/app/actions';
import { redirect } from 'next/navigation';
import { AnalyticsProvider } from '@/contexts/analytics-context';

export default async function StandaloneLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {

  const sessionData = await getUserSession();

  let session = null;
  if (!sessionData.error && sessionData.user) {
    session = {
      empresaId: sessionData.user.companyId,
      userId: sessionData.user.id,
      userData: sessionData.user,
      accessToken: sessionData.token || null,
    };
  }

  return (
    <SessionProvider value={session}>
      <AnalyticsProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen w-full bg-zinc-950 overflow-hidden">
            {children}
          </div>
        </ThemeProvider>
      </AnalyticsProvider>
    </SessionProvider>
  );
}
