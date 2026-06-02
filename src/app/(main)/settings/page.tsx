
'use client';

import { PageHeader } from '@/components/page-header';
import { TeamTable } from '@/components/settings/team-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plug, Settings } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { Api4ComIntegration } from '@/components/settings/api4com-integration';
import { MetaAdsIntegration } from '@/components/settings/meta-ads-integration';
import { GoogleCalendarIntegration } from '@/components/settings/google-calendar-integration';
import { KommoIntegration } from '@/components/settings/kommo-integration';

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
        <div className="overflow-x-auto -mx-2 px-2 pb-1 custom-scrollbar">
          <TabsList className="inline-flex h-12 items-center justify-center rounded-xl bg-black/20 p-1 text-zinc-400 border border-white/5">
            <TabsTrigger 
              value="team" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-6 py-2 text-sm font-medium transition-all data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:shadow-[0_0_15px_rgba(16,185,129,0.1)] gap-2"
            >
              <Users className="h-4 w-4 shrink-0" />
              Equipe
            </TabsTrigger>
            <TabsTrigger 
              value="integrations" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-6 py-2 text-sm font-medium transition-all data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:shadow-[0_0_15px_rgba(16,185,129,0.1)] gap-2"
            >
              <Plug className="h-4 w-4 shrink-0" />
              Integrações
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="team" className="mt-6">
          <motion.div {...tabMotion}>
            <TeamTable />
          </motion.div>
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <motion.div {...tabMotion}>
            <div className="space-y-6">
              <Api4ComIntegration />
              <MetaAdsIntegration />
              <GoogleCalendarIntegration />
              <KommoIntegration />
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

