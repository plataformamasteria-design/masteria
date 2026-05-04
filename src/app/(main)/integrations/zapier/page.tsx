'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Zap,
  Webhook,
  Shield,
  Code,
  CheckCircle2,
  Copy,
  ExternalLink,
} from 'lucide-react';

const WEBHOOK_EVENTS = [
  {
    id: 'conversation_created',
    label: 'Conversa Criada',
    description: 'Acionado quando uma nova conversa é iniciada',
  },
  {
    id: 'conversation_updated',
    label: 'Conversa Atualizada',
    description: 'Acionado quando uma conversa é atualizada',
  },
  {
    id: 'message_received',
    label: 'Mensagem Recebida',
    description: 'Acionado quando uma nova mensagem é recebida',
  },
  {
    id: 'message_sent',
    label: 'Mensagem Enviada',
    description: 'Acionado quando uma mensagem é enviada com sucesso',
  },
  {
    id: 'lead_created',
    label: 'Lead Criado',
    description: 'Acionado quando um novo lead é criado no sistema',
  },
  {
    id: 'lead_stage_changed',
    label: 'Estágio do Lead Alterado',
    description: 'Acionado quando um lead muda de estágio no funil',
  },
  {
    id: 'sale_closed',
    label: 'Venda Fechada',
    description: 'Acionado quando uma venda é marcada como concluída',
  },
  {
    id: 'meeting_scheduled',
    label: 'Reunião Agendada',
    description: 'Acionado quando uma reunião é agendada',
  },
  {
    id: 'campaign_sent',
    label: 'Campanha Enviada',
    description: 'Acionado quando uma campanha é enviada',
  },
  {
    id: 'campaign_completed',
    label: 'Campanha Concluída',
    description: 'Acionado quando todas as mensagens de uma campanha foram processadas',
  },
];

const EXAMPLE_PAYLOADS: Record<string, any> = {
  message_received: {
    event: 'message_received',
    timestamp: '2025-11-14T10:30:00Z',
    data: {
      conversationId: 'conv_123',
      messageId: 'msg_456',
      from: '+5511999999999',
      to: '+5511988888888',
      content: 'Olá, gostaria de mais informações',
      mediaUrl: null,
      createdAt: '2025-11-14T10:30:00Z',
    },
  },
  lead_created: {
    event: 'lead_created',
    timestamp: '2025-11-14T10:30:00Z',
    data: {
      leadId: 'lead_789',
      name: 'João Silva',
      email: 'joao@exemplo.com',
      phone: '+5511999999999',
      source: 'whatsapp',
      stage: 'novo',
      createdAt: '2025-11-14T10:30:00Z',
    },
  },
  sale_closed: {
    event: 'sale_closed',
    timestamp: '2025-11-14T10:30:00Z',
    data: {
      saleId: 'sale_321',
      leadId: 'lead_789',
      amount: 1500.00,
      currency: 'BRL',
      closedBy: 'user_123',
      closedAt: '2025-11-14T10:30:00Z',
    },
  },
};

export default function ZapierIntegrationPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [selectedEvent, setSelectedEvent] = useState('message_received');

  const _webhookEndpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/your-webhook-id`
    : 'https://your-domain.com/api/webhooks/your-webhook-id';

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência.`,
    });
  };

  const handleGoToWebhooks = () => {
    router.push('/integrations/webhooks');
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Integração Zapier</h1>
        </div>
        <p className="text-muted-foreground">
          Conecte sua aplicação ao Zapier e automatize seus fluxos de trabalho
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Como Configurar
          </CardTitle>
          <CardDescription>
            Siga os passos abaixo para integrar sua aplicação ao Zapier usando webhooks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  1
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold">Crie um Webhook</h3>
                <p className="text-sm text-muted-foreground">
                  Primeiro, você precisa criar um webhook na página de gerenciamento de webhooks.
                  Configure o nome, URL do Zapier e selecione os eventos que deseja receber.
                </p>
                <Button variant="outline" onClick={handleGoToWebhooks}>
                  <Webhook className="mr-2 h-4 w-4" />
                  Ir para Webhooks
                </Button>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  2
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold">Configure o Zapier</h3>
                <p className="text-sm text-muted-foreground">
                  No Zapier, crie um novo Zap e use &quot;Webhooks by Zapier&quot; como trigger. Escolha
                  &quot;Catch Hook&quot; e copie a URL fornecida.
                </p>
                <div className="rounded-lg border p-3 bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono flex-1">
                      https://hooks.zapier.com/hooks/catch/123456/abcdef/
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopy('https://hooks.zapier.com/hooks/catch/123456/abcdef/', 'URL do Zapier')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Exemplo de URL fornecida pelo Zapier
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  3
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold">Cole a URL no Webhook</h3>
                <p className="text-sm text-muted-foreground">
                  Volte para a página de webhooks e cole a URL do Zapier no campo &quot;URL&quot;.
                  Selecione os eventos que você deseja enviar para o Zapier.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  4
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold">Teste a Integração</h3>
                <p className="text-sm text-muted-foreground">
                  Use o botão &quot;Testar&quot; na página de webhooks para enviar um evento de teste
                  para o Zapier. Verifique se o Zapier recebeu o evento corretamente.
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground">
                    O Zapier deve mostrar os dados recebidos
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  5
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold">Configure as Ações</h3>
                <p className="text-sm text-muted-foreground">
                  No Zapier, adicione as ações que você deseja executar quando receber eventos.
                  Por exemplo: enviar email, criar tarefa no Trello, adicionar linha no Google Sheets, etc.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Eventos Disponíveis
          </CardTitle>
          <CardDescription>
            Escolha os eventos que você deseja receber no Zapier
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {WEBHOOK_EVENTS.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <Badge variant="outline" className="mt-0.5">
                  {event.id}
                </Badge>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm">{event.label}</h4>
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Exemplos de Payload
          </CardTitle>
          <CardDescription>
            Estrutura dos dados enviados para cada tipo de evento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedEvent} onValueChange={setSelectedEvent}>
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5">
              <TabsTrigger value="message_received" className="text-xs">
                Mensagem
              </TabsTrigger>
              <TabsTrigger value="lead_created" className="text-xs">
                Lead Criado
              </TabsTrigger>
              <TabsTrigger value="sale_closed" className="text-xs">
                Venda
              </TabsTrigger>
            </TabsList>

            {Object.entries(EXAMPLE_PAYLOADS).map(([eventType, payload]) => (
              <TabsContent key={eventType} value={eventType} className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">Exemplo de Payload</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(JSON.stringify(payload, null, 2), 'Payload')}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </Button>
                  </div>
                  <pre className="text-xs overflow-x-auto p-3 rounded bg-black/5 dark:bg-white/5">
                    <code>{JSON.stringify(payload, null, 2)}</code>
                  </pre>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Segurança
          </CardTitle>
          <CardDescription>
            Como verificar a autenticidade dos webhooks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Assinatura HMAC SHA256</h4>
            <p className="text-sm text-muted-foreground">
              Todos os webhooks enviados incluem um header <code className="px-1 py-0.5 rounded bg-muted text-xs">X-Webhook-Signature</code> que
              contém uma assinatura HMAC SHA256 do payload. Use isso para verificar que o webhook
              veio realmente da nossa aplicação.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <h5 className="font-semibold text-sm">Exemplo de Verificação (Node.js):</h5>
            <div className="relative">
              <pre className="text-xs overflow-x-auto p-3 rounded bg-black/5 dark:bg-white/5">
                <code>{`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

// Uso
const isValid = verifyWebhook(
  req.body,
  req.headers['x-webhook-signature'],
  process.env.WEBHOOK_SECRET
);

if (!isValid) {
  return res.status(401).send('Invalid signature');
}`}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => handleCopy(`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}`, 'Código de verificação')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-4">
            <h5 className="font-semibold text-sm text-yellow-800 dark:text-yellow-200 mb-2">
              ⚠️ Importante
            </h5>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Sempre verifique a assinatura do webhook antes de processar o payload.
              Isso evita que requisições maliciosas sejam processadas pela sua aplicação.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-3 rounded-full bg-primary/10">
              <ExternalLink className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Precisa de Ajuda?</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Consulte a documentação do Zapier para mais informações sobre como configurar
                webhooks e criar automações poderosas.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleGoToWebhooks}>
                <Webhook className="mr-2 h-4 w-4" />
                Gerenciar Webhooks
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="https://zapier.com/apps/webhook/help"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Documentação Zapier
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
