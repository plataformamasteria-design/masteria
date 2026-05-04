// src/app/api/v1/test-integrations/send-test-message/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

interface SendMessageRequest {
  phone_number?: string;
  template_name?: string;
  language_code?: string;
  test_text?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendMessageRequest = await request.json();
    const {
      phone_number = '5562999999999', // Número de teste padrão
      template_name = 'hello_world', // Template padrão do WhatsApp
      language_code = 'pt_BR',
      test_text = false
    } = body;
    
    const wabaId = '399691246563833';
    const connectionId = '51d60e9b-b308-4193-85d7-192ff6f4e3d8'; // GRUPO EDUCACIONAL AG12X
    const apiVersion = process.env.FACEBOOK_API_VERSION || 'v23.0';
    
    // Buscar a conexão específica
    const [connection] = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.id, connectionId),
          eq(connections.wabaId, wabaId)
        )
      );
    
    if (!connection) {
      return NextResponse.json({
        success: false,
        error: 'Conexão não encontrada',
        details: { connectionId, wabaId }
      }, { status: 404 });
    }
    
    if (!connection.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Token de acesso não configurado para esta conexão'
      }, { status: 500 });
    }
    const accessToken = decrypt(connection.accessToken);
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Falha ao desencriptar o token de acesso'
      }, { status: 500 });
    }
    
    // URL para envio de mensagem
    const url = `https://graph.facebook.com/${apiVersion}/${connection.phoneNumberId}/messages`;
    
    let payload: any;
    
    if (test_text) {
      // Enviar mensagem de texto simples
      payload = {
        messaging_product: 'whatsapp',
        to: phone_number,
        type: 'text',
        text: {
          body: `🔧 Teste de integração WhatsApp Business\\n\\nEsta é uma mensagem de teste enviada em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\\n\\n✅ Configuração funcionando corretamente!\\n\\n📱 Phone Number ID: ${connection.phoneNumberId}\\n🏢 WABA ID: ${wabaId}\\n🔌 Connection: ${connection.config_name}`,
          preview_url: true
        }
      };
    } else {
      // Enviar template message
      payload = {
        messaging_product: 'whatsapp',
        to: phone_number,
        type: 'template',
        template: {
          name: template_name,
          language: {
            code: language_code
          }
        }
      };
    }
    
    console.log('[Test Message] Enviando para:', phone_number);
    console.log('[Test Message] Payload:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('[Test Message] Erro na API:', data);
      return NextResponse.json({
        success: false,
        error: 'Erro ao enviar mensagem',
        api_error: data.error,
        details: {
          status_code: response.status,
          error_message: data.error?.message,
          error_code: data.error?.code,
          error_type: data.error?.type,
          error_subcode: data.error?.error_subcode,
          fbtrace_id: data.error?.fbtrace_id
        },
        config: {
          connection_id: connection.id,
          connection_name: connection.config_name,
          phone_number_id: connection.phoneNumberId,
          waba_id: wabaId,
          is_active: connection.isActive
        }
      }, { status: response.status });
    }
    
    console.log('[Test Message] Sucesso:', data);
    
    return NextResponse.json({
      success: true,
      message: 'Mensagem enviada com sucesso!',
      response: {
        messages: data.messages,
        messaging_product: data.messaging_product,
        contacts: data.contacts
      },
      details: {
        message_type: test_text ? 'text' : 'template',
        template_name: test_text ? null : template_name,
        recipient: phone_number,
        wamid: data.messages?.[0]?.id
      },
      config: {
        connection_id: connection.id,
        connection_name: connection.config_name,
        phone_number_id: connection.phoneNumberId,
        waba_id: wabaId,
        is_active: connection.isActive,
        api_version: apiVersion
      }
    });
    
  } catch (error: any) {
    console.error('[Test Message] Erro geral:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao processar requisição',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// GET endpoint para obter informações sobre templates disponíveis
export async function GET() {
  try {
    const wabaId = '399691246563833';
    const connectionId = '51d60e9b-b308-4193-85d7-192ff6f4e3d8';
    const apiVersion = process.env.FACEBOOK_API_VERSION || 'v23.0';
    
    // Buscar a conexão
    const [connection] = await db
      .select()
      .from(connections)
      .where(eq(connections.id, connectionId));
    
    if (!connection) {
      return NextResponse.json({
        success: false,
        error: 'Conexão não encontrada'
      }, { status: 404 });
    }
    
    if (!connection.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Token de acesso não configurado para esta conexão'
      }, { status: 500 });
    }
    const accessToken = decrypt(connection.accessToken);
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Falha ao desencriptar o token de acesso'
      }, { status: 500 });
    }
    
    // Buscar templates disponíveis
    const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar templates',
        api_error: data.error
      }, { status: response.status });
    }
    
    // Filtrar templates aprovados
    const approvedTemplates = (data.data || []).filter(
      (template: any) => template.status === 'APPROVED'
    );
    
    return NextResponse.json({
      success: true,
      message: 'Para testar o envio de mensagem, faça um POST para este endpoint',
      instructions: {
        method: 'POST',
        body_params: {
          phone_number: 'Número do WhatsApp no formato internacional (ex: 5562999999999)',
          template_name: 'Nome do template aprovado (opcional, padrão: hello_world)',
          language_code: 'Código do idioma (opcional, padrão: pt_BR)',
          test_text: 'Se true, envia mensagem de texto ao invés de template (opcional, padrão: false)'
        },
        example_curl: `curl -X POST http://localhost:5000/api/v1/test-integrations/send-test-message -H "Content-Type: application/json" -d '{"phone_number":"5562999999999","test_text":true}'`
      },
      available_templates: approvedTemplates.map((t: any) => ({
        name: t.name,
        status: t.status,
        language: t.language,
        category: t.category
      })),
      config: {
        connection_id: connection.id,
        connection_name: connection.config_name,
        phone_number_id: connection.phoneNumberId,
        waba_id: wabaId,
        is_active: connection.isActive
      }
    });
    
  } catch (error: any) {
    console.error('[Test Message Info] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}