
'use client';

import { PageHeader } from '@/components/page-header';
import { TeamTable } from '@/components/settings/team-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Webhook, KeyRound, BrainCircuit, ArrowDown, Plug, Settings, Workflow, Phone, GalleryVertical } from 'lucide-react';
import { WebhooksManager } from '@/components/settings/webhooks-manager';
import { IncomingWebhooksManager } from '@/components/settings/incoming-webhooks-manager';
import { ApiKeysManager } from '@/components/settings/api-keys-manager';
import { AiSettingsManager } from '@/components/settings/ai-settings-manager';
import { GoogleCalendarIntegration } from '@/components/settings/google-calendar-integration';
import { KommoIntegration } from '@/components/settings/kommo-integration';
import { AutomationManager } from '@/components/automations/automation-manager';
import { GalleryClient } from '@/components/gallery/gallery-client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load heavy Voice AI component
const VoiceAIContent = dynamic(() => import('@/app/(main)/voice-ai/page'), {
  ssr: false,
  loading: () => <div className="space-y-4"><Skeleton className="h-64 w-full rounded-xl" /></div>
});

const tabMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: 'easeOut' },
};

export default function ManagementPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão da Empresa"
        description="Gerencie sua equipe e as configurações de integração da plataforma."
        icon={Settings}
      />

      <Tabs defaultValue="team" className="w-full">
        <div className="overflow-x-auto -mx-2 px-2 pb-1">
          <TabsList className="inline-flex h-auto min-w-max gap-1">
            <TabsTrigger value="team" className="gap-1.5 px-3 py-2 text-xs sm:text-sm">
              <Users className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Equipe</span>
              <span className="sm:hidden">Equipe</span>
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-1.5 px-3 py-2 text-xs sm:text-sm">
              <Workflow className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Automação</span>
              <span className="sm:hidden">Auto</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 px-3 py-2 text-xs sm:text-sm">
              <BrainCircuit className="h-4 w-4 shrink-0" />
              IA
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5 px-3 py-2 text-xs sm:text-sm">
              <Plug className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Integrações</span>
              <span className="sm:hidden">Integ.</span>
            </TabsTrigger>
            <TabsTrigger value="incoming-webhooks" className="gap-1.5 px-3 py-2 text-xs sm:text-sm">
              <ArrowDown className="h-4 w-4 shrink-0" />
              Entrada
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-1.5 px-3 py-2 text-xs sm:text-sm">
              <Webhook className="h-4 w-4 shrink-0" />
              Saída
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-1.5 px-3 py-2 text-xs sm:text-sm">
              <KeyRound className="h-4 w-4 shrink-0" />
              API
            </TabsTrigger>
            <TabsTrigger value="voice-ai" className="gap-1.5 px-3 py-2 text-xs sm:text-sm">
              <Phone className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Voice IA</span>
              <span className="sm:hidden">Voz</span>
            </TabsTrigger>
            <TabsTrigger value="gallery" className="gap-1.5 px-3 py-2 text-xs sm:text-sm">
              <GalleryVertical className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Galeria</span>
              <span className="sm:hidden">Gal.</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="team" className="mt-6">
          <motion.div {...tabMotion}>
            <TeamTable />
          </motion.div>
        </TabsContent>
        <TabsContent value="automations" className="mt-6">
          <motion.div {...tabMotion}>
            <AutomationManager />
          </motion.div>
        </TabsContent>
        <TabsContent value="ai" className="mt-6">
          <motion.div {...tabMotion}>
            <AiSettingsManager />
          </motion.div>
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <motion.div {...tabMotion}>
            <div className="space-y-6">
              <GoogleCalendarIntegration />
              <KommoIntegration />
            </div>
          </motion.div>
        </TabsContent>
        <TabsContent value="incoming-webhooks" className="mt-6">
          <motion.div {...tabMotion}>
            <IncomingWebhooksManager />
          </motion.div>
        </TabsContent>
        <TabsContent value="webhooks" className="mt-6">
          <motion.div {...tabMotion}>
            <WebhooksManager />
          </motion.div>
        </TabsContent>
        <TabsContent value="api" className="mt-6">
          <motion.div {...tabMotion}>
            <ApiKeysManager />
          </motion.div>
        </TabsContent>
        <TabsContent value="voice-ai" className="mt-6">
          <motion.div {...tabMotion}>
            <VoiceAIContent />
          </motion.div>
        </TabsContent>
        <TabsContent value="gallery" className="mt-6">
          <motion.div {...tabMotion}>
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
              <GalleryClient />
            </Suspense>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

