

import { AppSidebar, SidebarProvider } from '@/components/app-sidebar';
import { ThemeProvider } from '@/components/theme-provider';
import { SessionProvider, MainContent } from '@/contexts/session-context';
import type { ReactNode } from 'react';
import { getUserSession } from '@/app/actions';
import { AnalyticsProvider } from '@/contexts/analytics-context';
import { redirect } from 'next/navigation';

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {

  const sessionData = await getUserSession();
  
  if (sessionData.error || !sessionData.user) {
    return redirect(`/login?error=token_nao_encontrado`);
  }
  
  if (sessionData.user.role !== 'superadmin') {
    return redirect('/dashboard');
  }

  const session = {
      empresaId: sessionData.user.companyId,
      userId: sessionData.user.id,
      userData: sessionData.user,
      accessToken: null,
  };

  return (
    <SessionProvider value={session}>
        <AnalyticsProvider>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                <SidebarProvider>
                <div className="flex h-screen w-full bg-background overflow-hidden">
                    <AppSidebar />
                    <MainContent>{children}</MainContent>
                </div>
                </SidebarProvider>
            </ThemeProvider>
        </AnalyticsProvider>
    </SessionProvider>
  );
}

