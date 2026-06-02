import { AppSidebar, SidebarProvider, MobileMenuButton } from '@/components/app-sidebar';
import { MobileNav } from '@/components/responsive/mobile-nav';
import { ThemeProvider } from '@/components/theme-provider';
import { SessionProvider, MainContent } from '@/contexts/session-context';
import type { ReactNode } from 'react';
import { getUserSession } from '@/app/actions';
import { redirect } from 'next/navigation';
import { AnalyticsProvider } from '@/contexts/analytics-context';
import { LazyDevTools } from '@/components/dev/lazy-dev-tools';
import { PrefsApplier } from '@/components/prefs-applier';


export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {

  const sessionData = await getUserSession();

  if (sessionData.error || !sessionData.user) {
    const params = new URLSearchParams();
    if (sessionData.errorCode) {
      params.set('error', sessionData.errorCode);
    }
    return redirect(`/login?${params.toString()}`);
  }

  const session = {
    empresaId: sessionData.user.companyId,
    userId: sessionData.user.id,
    userData: sessionData.user,
    accessToken: sessionData.token || null,
  };

  return (
    <SessionProvider value={session}>
      <AnalyticsProvider>
        <SidebarProvider>
          <PrefsApplier />
          <div className="flex h-screen w-full bg-background overflow-hidden relative text-foreground selection:bg-emerald-500/30">
            {/* Luzes globais para o ambiente interno */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
              <div className="absolute -top-[20%] -left-[10%] h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-[120px]" />
              <div className="absolute top-[20%] -right-[10%] h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />
              <div className="absolute -bottom-[10%] left-[20%] h-[600px] w-[600px] rounded-full bg-purple-500/5 blur-[150px]" />
            </div>
            
            <div className="relative z-10 flex h-full w-full">
              <MobileMenuButton />
              <AppSidebar />
              <MainContent>
                {children}
              </MainContent>
              <MobileNav />
            </div>
          </div>
        </SidebarProvider>
        <LazyDevTools />
      </AnalyticsProvider>
    </SessionProvider>
  );
}
