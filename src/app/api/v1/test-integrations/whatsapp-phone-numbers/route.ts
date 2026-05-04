// src/app/api/v1/test-integrations/whatsapp-phone-numbers/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const wabaId = '399691246563833';
    const apiVersion = process.env.FACEBOOK_API_VERSION || 'v23.0';
    
    // Buscar conexões com o WABA ID específico no banco
    const connectionsFromDb = await db
      .select()
      .from(connections)
      .where(eq(connections.wabaId, wabaId));
    
    if (connectionsFromDb.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhuma conexão encontrada com o WABA ID especificado',
        waba_id: wabaId
      }, { status: 404 });
    }
    
    const results = [];
    
    for (const connection of connectionsFromDb) {
      if (!connection.accessToken) {
        results.push({
          connection_id: connection.id,
          config_name: connection.config_name,
          error: 'Token de acesso não configurado',
          status: 'error'
        });
        continue;
      }
      
      const accessToken = decrypt(connection.accessToken);
      
      if (!accessToken) {
        results.push({
          connection_id: connection.id,
          config_name: connection.config_name,
          error: 'Falha ao desencriptar o token de acesso',
          status: 'error'
        });
        continue;
      }
      
      try {
        // Fazer chamada à API Meta para obter os phone numbers
        const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/phone_numbers`;
        console.log(`[Test API] Chamando: ${url}`);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          results.push({
            connection_id: connection.id,
            config_name: connection.config_name,
            current_phone_number_id: connection.phoneNumberId,
            error: data.error?.message || 'Erro desconhecido',
            error_code: data.error?.code,
            error_type: data.error?.type,
            error_subcode: data.error?.error_subcode,
            status: 'error'
          });
        } else {
          // Processar phone numbers retornados
          const phoneNumbers = data.data || [];
          const phoneNumberDetails = phoneNumbers.map((phone: any) => ({
            id: phone.id,
            display_phone_number: phone.display_phone_number,
            verified_name: phone.verified_name,
            code_verification_status: phone.code_verification_status,
            quality_rating: phone.quality_rating,
            platform_type: phone.platform_type,
            throughput: phone.throughput
          }));
          
          // Verificar se o Phone Number ID configurado está correto
          const configuredId = connection.phoneNumberId;
          const isConfigCorrect = phoneNumberDetails.some((p: any) => p.id === configuredId);
          
          results.push({
            connection_id: connection.id,
            config_name: connection.config_name,
            current_phone_number_id: configuredId,
            is_active: connection.isActive,
            status: 'success',
            phone_numbers_found: phoneNumbers.length,
            phone_numbers: phoneNumberDetails,
            configuration_status: isConfigCorrect ? 'correct' : 'needs_update',
            suggested_phone_number_id: phoneNumberDetails.length > 0 ? phoneNumberDetails[0].id : null
          });
        }
      } catch (error: any) {
        results.push({
          connection_id: connection.id,
          config_name: connection.config_name,
          error: error.message,
          status: 'error'
        });
      }
    }
    
    // Analisar resultados
    const successResults = results.filter(r => r.status === 'success');
    const needsUpdate = successResults.filter(r => r.configuration_status === 'needs_update');
    
    return NextResponse.json({
      success: true,
      waba_id: wabaId,
      api_version: apiVersion,
      total_connections: connectionsFromDb.length,
      connections_tested: results.length,
      successful_tests: successResults.length,
      needs_update: needsUpdate.length,
      results,
      recommendations: needsUpdate.length > 0 
        ? needsUpdate.map((r: any) => ({
            connection_id: r.connection_id,
            config_name: r.config_name,
            current_id: r.current_phone_number_id,
            suggested_id: r.suggested_phone_number_id,
            action: `Atualize o Phone Number ID de ${r.current_phone_number_id} para ${r.suggested_phone_number_id}`
          }))
        : ['Todas as conexões estão com o Phone Number ID correto']
    });
    
  } catch (error: any) {
    console.error('Erro ao testar Phone Numbers WhatsApp:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// POST endpoint para atualizar Phone Number ID se necessário
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connection_id, phone_number_id } = body;
    
    if (!connection_id || !phone_number_id) {
      return NextResponse.json(
        { error: 'connection_id e phone_number_id são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Atualizar o Phone Number ID da conexão
    const [updatedConnection] = await db
      .update(connections)
      .set({ phoneNumberId: phone_number_id })
      .where(eq(connections.id, connection_id))
      .returning();
    
    if (!updatedConnection) {
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Phone Number ID atualizado para ${phone_number_id}`,
      connection: {
        id: updatedConnection.id,
        config_name: updatedConnection.config_name,
        phone_number_id: updatedConnection.phoneNumberId,
        waba_id: updatedConnection.wabaId
      }
    });
    
  } catch (error: any) {
    console.error('Erro ao atualizar Phone Number ID:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}