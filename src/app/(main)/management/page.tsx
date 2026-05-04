'use client';

import { PageHeader } from '@/components/page-header';
import { TeamTable } from '@/components/settings/team-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Webhook, KeyRound, BrainCircuit, ArrowDown, Plug, Settings, Workflow } from 'lucide-react';
import { WebhooksManager } from '@/components/settings/webhooks-manager';
import { IncomingWebhooksManager } from '@/components/settings/incoming-webhooks-manager';
import { ApiKeysManager } from '@/components/settings/api-keys-manager';
import { AiSettingsManager } from '@/components/settings/ai-settings-manager';
import { GoogleCalendarIntegration } from '@/components/settings/google-calendar-integration';
import { KommoIntegration } from '@/components/settings/kommo-integration';
import { AutomationManager } from '@/components/automations/automation-manager';


export default function ManagementPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão da Empresa"
        description="Gerencie sua equipe e as configurações de integração da plataforma."
        icon={Settings}
      />

      <Tabs defaultValue="team" className="w-full">
        <TabsList className="grid w-full h-auto grid-cols-2 sm:grid-cols-7">
          <TabsTrigger value="team">
            <Users className="mr-2 h-4 w-4" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="automations">
            <Workflow className="mr-2 h-4 w-4" />
            Automação
          </TabsTrigger>
          <TabsTrigger value="ai">
            <BrainCircuit className="mr-2 h-4 w-4" />
            IA
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Plug className="mr-2 h-4 w-4" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="incoming-webhooks">
            <ArrowDown className="mr-2 h-4 w-4" />
            Entrada
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="mr-2 h-4 w-4" />
            Saída
          </TabsTrigger>
          <TabsTrigger value="api">
            <KeyRound className="mr-2 h-4 w-4" />
            API
          </TabsTrigger>
        </TabsList>
        <TabsContent value="team" className="mt-6">
          <TeamTable />
        </TabsContent>
        <TabsContent value="automations" className="mt-6">
          <AutomationManager />
        </TabsContent>
        <TabsContent value="ai" className="mt-6">
          <AiSettingsManager />
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <div className="space-y-4">
            <GoogleCalendarIntegration />
            <KommoIntegration />
          </div>
        </TabsContent>
        <TabsContent value="incoming-webhooks" className="mt-6">
          <IncomingWebhooksManager />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-6">
          <WebhooksManager />
        </TabsContent>
        <TabsContent value="api" className="mt-6">
          <ApiKeysManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
