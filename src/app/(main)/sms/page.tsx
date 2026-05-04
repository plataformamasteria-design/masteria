// src/app/(main)/sms/page.tsx
import { PageHeader } from '@/components/page-header';
import { SmsGatewaysManager } from '@/components/settings/sms-gateways-manager';
import { CampaignTable } from '@/components/campaigns/campaign-table';
import { CreateSmsCampaignDialog } from '@/components/campaigns/create-sms-campaign-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { getCompanyIdFromSession } from '@/app/actions';

// ID da Empresa Super Admin (Diego Abner Rodrigues Santana's Company)
const SUPER_ADMIN_COMPANY_ID = '9fca0bf3-57b1-47ff-aed1-bbc5c2cb2d76';

export default async function SmsPage() {
  const companyId = await getCompanyIdFromSession();
  const isSuperAdmin = companyId === SUPER_ADMIN_COMPANY_ID;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Gestão de SMS"
        description="Gerencie seus gateways de envio e suas campanhas de SMS."
      >
        <CreateSmsCampaignDialog>
             <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar Campanha SMS
            </Button>
        </CreateSmsCampaignDialog>
      </PageHeader>

      <div className="space-y-8">
        {/* Seção de Gateways - Visível apenas para Super Admin */}
        {isSuperAdmin && (
          <section className="space-y-4">
              <SmsGatewaysManager />
          </section>
        )}

        {/* Seção de Campanhas - Lista histórica logo abaixo */}
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Histórico de Campanhas</h2>
            </div>
            <CampaignTable channel="SMS" />
        </section>
      </div>
    </div>
  );
}
