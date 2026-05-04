'use client';

import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { CampaignTable } from './campaign-table';

export function BaileysCampaignTable() {
  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Campanhas WhatsApp Business (Baileys):</strong> Campanhas estruturadas via Baileys com suporte a variáveis, delay customizável e agendamento. Ideal para automação em massa.
        </AlertDescription>
      </Alert>
      
      <CampaignTable channel="WHATSAPP" baileysOnly={true} />
    </div>
  );
}
