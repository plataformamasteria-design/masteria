'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { CampaignTable } from '@/components/campaigns/campaign-table';
import { CreateCampaignDialog } from '@/components/campaigns/create-campaign-dialog';
import { CampaignsDashboard } from '@/components/campaigns/campaigns-dashboard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, FileText, BarChart3 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState('campaigns');

  return (
    <div className="space-y-6">
       <PageHeader
          title="Campanhas WhatsApp Normal"
          description="Envie campanhas de texto simples via WhatsApp pessoal/empresarial (QR Code)"
        >
            <div className="flex gap-2">
              <CreateCampaignDialog>
                  <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Criar Campanha
                  </Button>
              </CreateCampaignDialog>
              <Link href="/templates-v2">
                <Button variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    Templates
                </Button>
              </Link>
            </div>
       </PageHeader>

       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
         <TabsList className="grid w-full max-w-xs grid-cols-2">
           <TabsTrigger value="campaigns" className="flex gap-2">
             <PlusCircle className="h-4 w-4" />
             Campanhas
           </TabsTrigger>
           <TabsTrigger value="dashboard" className="flex gap-2">
             <BarChart3 className="h-4 w-4" />
             Dashboard
           </TabsTrigger>
         </TabsList>

         <TabsContent value="campaigns" className="mt-6">
           <CampaignTable channel="WHATSAPP" />
         </TabsContent>

         <TabsContent value="dashboard" className="mt-6">
           <CampaignsDashboard />
         </TabsContent>
       </Tabs>
    </div>
  );
}
