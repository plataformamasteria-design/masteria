// src/app/admin/agents/performance/page.tsx
import { Metadata } from 'next';
import { getUserSession } from '@/app/actions';
import { redirect } from 'next/navigation';
import { AgentPerformanceDashboard } from '@/components/admin/agents/agent-performance-dashboard';

export const metadata: Metadata = {
  title: 'Performance dos Agentes | Admin',
  description: 'Dashboard de métricas e performance dos agentes de IA',
};

export default async function AgentPerformancePage() {
  const { user } = await getUserSession();
  
  if (!user) {
    redirect('/login');
  }
  
  // Verificar se é admin ou superadmin
  if (!['admin', 'superadmin'].includes(user.role)) {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto py-6">
      <AgentPerformanceDashboard />
    </div>
  );
}