// src/app/(main)/automations/page.tsx
'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { AutomationManager } from '@/components/automations/automation-manager';
import { AutomationExecutions } from '@/components/automations/automation-executions';
import { AutomationLogs } from '@/components/automations/automation-logs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Calendar, History } from 'lucide-react';

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState('rules');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automações"
        description="Crie regras para automatizar tarefas e fluxos de trabalho."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-1 h-12">
          <TabsTrigger value="rules" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground dark:data-[state=active]:text-white transition-all">
            <Settings className="h-4 w-4" />
            Regras
          </TabsTrigger>
          <TabsTrigger value="executions" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground dark:data-[state=active]:text-white transition-all">
            <History className="h-4 w-4" />
            Execuções
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground dark:data-[state=active]:text-white transition-all">
            <Calendar className="h-4 w-4" />
            Logs (Legado)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-6">
          <AutomationManager />
        </TabsContent>

        <TabsContent value="executions" className="mt-6">
          <AutomationExecutions />
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <AutomationLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
