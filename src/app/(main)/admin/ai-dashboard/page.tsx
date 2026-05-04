// src/app/(main)/admin/ai-dashboard/page.tsx
'use client';

import { PageHeader } from '@/components/page-header';
import { AiMetricsDashboard } from '@/components/admin/ai-dashboard/ai-metrics-dashboard';

export default function AiDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin - Dashboard de IA"
        description="Monitore a performance, uso, custos e erros do sistema de inteligência artificial."
      />
      <AiMetricsDashboard />
    </div>
  );
}
