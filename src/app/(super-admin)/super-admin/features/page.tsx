'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

const FEATURES = [
  { id: 'CRM_BASIC', name: 'CRM Básico', description: 'Gerenciamento simples de contatos' },
  { id: 'CRM_ADVANCED', name: 'CRM Avançado', description: 'CRM com análises avançadas' },
  { id: 'WHATSAPP_API', name: 'WhatsApp API', description: 'Integração Meta WhatsApp Business' },
  { id: 'WHATSAPP_BAILEYS', name: 'WhatsApp Baileys', description: 'WhatsApp com QR Code (local)' },
  { id: 'SMS', name: 'SMS', description: 'Envio de mensagens SMS' },
  { id: 'VOICE_AI', name: 'Voice AI (Retell)', description: 'Chamadas automatizadas com IA' },
  { id: 'EMAIL_SENDING', name: 'Email Sending', description: 'Envio de emails em massa' },
  { id: 'EMAIL_TRACKING', name: 'Email Tracking', description: 'Rastreamento de emails' },
  { id: 'AI_AUTOMATION', name: 'IA Automation', description: 'Automações com OpenAI' },
  { id: 'CAMPAIGNS', name: 'Campanhas', description: 'Gerenciamento de campanhas' },
  { id: 'ANALYTICS', name: 'Analytics', description: 'Análises e relatórios' },
];

export default function FeaturesPage() {
  const [features] = useState(FEATURES);

  return (
    <div className="space-y-6">
      <PageHeader title="Gerenciamento de Features" description="Configure as 11 features disponíveis do sistema" />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map(feature => (
          <Card key={feature.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                {feature.name}
                <Badge variant="secondary">{feature.id.replace(/_/g, ' ')}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
              <div className="mt-4 flex gap-2">
                <button className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">Ativar</button>
                <button className="px-3 py-1 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Desativar</button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
