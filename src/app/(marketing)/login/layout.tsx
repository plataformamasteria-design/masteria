import { getUserSession } from '@/app/actions';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export default async function LoginLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  const sessionData = await getUserSession();

  // Se o usuário já estiver logado, redireciona para a dashboard
  if (sessionData && !sessionData.error && sessionData.user) {
    return redirect('/dashboard');
  }

  return <>{children}</>;
}
