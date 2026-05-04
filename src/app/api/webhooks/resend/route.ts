// src/app/api/webhooks/resend/route.ts
// Webhook para eventos de email do Resend (sent, delivered, opened, clicked, bounced, complained)
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { emailEvents } from '@/lib/db/schema';
import { randomUUID } from 'crypto';

// Tipos de eventos esperados do Resend
type ResendWebhookPayload = {
  type: string;
  created_at: string;
  data: {
    from: string;
    to: string[];
    subject: string;
    email_id: string;
    [key: string]: any;
  };
};

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = randomUUID().slice(0, 8);
  console.log(`[WEBHOOK_RESEND:${requestId}] Recebido webhook do Resend`);

  try {
    // 1. Parsear JSON do request
    const payload: ResendWebhookPayload = await request.json();

    // 2. Verificar assinatura SVIX (opcional em dev, recomendado em prod)
    const signature = request.headers.get('svix-signature');
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      console.log(`[WEBHOOK_RESEND:${requestId}] Verificando assinatura SVIX...`);
      // TODO: Implementar verificação SVIX usando svix library
      // npm install svix
      // const svix = new Svix(webhookSecret);
      // const isValid = svix.verify(body, signature);
    }
    console.log(`[WEBHOOK_RESEND:${requestId}] Evento:`, payload.type);

    // 4. Mapear tipo de evento
    const eventTypeMap: { [key: string]: string } = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.opened': 'opened',
      'email.clicked': 'clicked',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
      'email.delivery_delayed': 'delivery_delayed',
    };

    const eventType = eventTypeMap[payload.type] || 'sent';

    // 5. Extrair dados
    const emailId = payload.data.email_id;
    const recipient = payload.data.to?.[0] || payload.data.from || 'unknown';
    const subject = payload.data.subject || '';
    const createdAt = new Date(payload.created_at);

    console.log(
      `[WEBHOOK_RESEND:${requestId}] ${eventType.toUpperCase()} - ${recipient}`
    );

    // 6. Salvar evento no banco
    await db.insert(emailEvents).values({
      emailId,
      eventType: eventType as any, // Type será validado pelo enum
      recipient,
      subject,
      metadata: payload.data,
      createdAt,
    });

    console.log(`[WEBHOOK_RESEND:${requestId}] ✅ Evento salvo no banco`);

    // 7. Processar eventos específicos
    if (eventType === 'bounced' || eventType === 'complained') {
      console.warn(
        `[WEBHOOK_RESEND:${requestId}] ⚠️ Email ${eventType}: ${recipient}`
      );
      // TODO: Implementar lógica para remover email de lista de envio
    }

    if (eventType === 'opened') {
      console.log(`[WEBHOOK_RESEND:${requestId}] 📧 Email aberto: ${recipient}`);
      // TODO: Implementar rastreamento de engagement
    }

    if (eventType === 'clicked') {
      console.log(`[WEBHOOK_RESEND:${requestId}] 🔗 Link clicado: ${recipient}`);
      // TODO: Implementar rastreamento de conversão
    }

    return NextResponse.json({
      received: true,
      eventType,
      emailId,
    });
  } catch (error) {
    console.error(`[WEBHOOK_RESEND:${requestId}] Erro:`, error);
    
    // Retornar 200 mesmo em erro para evitar retry infinito
    return NextResponse.json(
      { error: 'Erro ao processar webhook', requestId },
      { status: 200 }
    );
  }
}
