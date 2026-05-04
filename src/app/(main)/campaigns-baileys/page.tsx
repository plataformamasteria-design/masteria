'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { BaileysCampaignTable } from '@/components/campaigns/baileys-campaign-table';
import { CreateBaileysCampaignDialog } from '@/components/campaigns/create-baileys-campaign-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function BaileysCampaignsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Campanhas WhatsApp Business (Baileys)"
        description="Envie campanhas estruturadas via WhatsApp Business API usando Baileys."
      >
        <div className="flex gap-2">
          <CreateBaileysCampaignDialog>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Criar Campanha
            </Button>
          </CreateBaileysCampaignDialog>
          <Link href="/templates">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Templates
            </Button>
          </Link>
        </div>
      </PageHeader>
      <BaileysCampaignTable />
    </div>
  );
}
