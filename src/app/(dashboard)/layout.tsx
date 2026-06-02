import { ThemeProvider } from '@/components/theme-provider';
import { SessionProvider, MainContent } from '@/contexts/session-context';
import type { ReactNode } from 'react';
import { getUserSession } from '@/app/actions';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {

  const sessionData = await getUserSession();

  if (sessionData.error || !sessionData.user) {
    const errorCode = sessionData.errorCode || 'token_nao_encontrado';
    const errorMessage = encodeURIComponent(sessionData.error || 'Sessão inválida');
    return redirect(`/login?error=${errorCode}&details=${errorMessage}`);
  }

  const session = {
    empresaId: sessionData.user.companyId,
    userId: sessionData.user.id,
    userData: sessionData.user,
    accessToken: null,
  };

  return (
    <SessionProvider value={session}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <MainContent>{children}</MainContent>
      </div>
    </SessionProvider>
  );
}
