'use client';

import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { CampaignTable } from './campaign-table';

export function BaileysCampaignTable() {
  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-xl flex items-start gap-3 backdrop-blur-md shadow-[0_0_20px_rgba(59,130,246,0.1)]">
        <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <strong className="text-blue-300 font-semibold tracking-wide">Campanhas WhatsApp Business (Baileys):</strong> Campanhas estruturadas via Baileys com suporte a variáveis, delay customizável e agendamento. Ideal para automação em massa.
        </div>
      </div>
      
      <CampaignTable channel="WHATSAPP" baileysOnly={true} />
    </div>
  );
}
