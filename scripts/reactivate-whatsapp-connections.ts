#!/usr/bin/env tsx

import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../src/lib/crypto';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v20.0';

interface ConnectionTestResult {
  id: string;
  configName: string;
  phoneNumberId: string;
  currentStatus: boolean;
  testResult: 'valid' | 'expired' | 'decryption_failed' | 'network_error';
  errorMessage?: string;
  shouldReactivate: boolean;
  phoneNumber?: string;
  displayName?: string;
}

async function testWhatsAppConnection(
  connectionId: string,
  configName: string,
  phoneNumberId: string,
  encryptedAccessToken: string,
  currentStatus: boolean
): Promise<ConnectionTestResult> {
  console.log(`\n🔍 Testando conexão: ${configName} (ID: ${connectionId.substring(0, 8)}...)`);
  
  const result: ConnectionTestResult = {
    id: connectionId,
    configName,
    phoneNumberId,
    currentStatus,
    testResult: 'network_error',
    shouldReactivate: false,
  };

  try {
    const accessToken = decrypt(encryptedAccessToken);
    
    if (!accessToken || accessToken.length < 10) {
      result.testResult = 'decryption_failed';
      result.errorMessage = 'Token decryption failed or token is invalid';
      console.log('   ❌ Falha na descriptografia do token');
      return result;
    }

    console.log('   ✅ Token descriptografado com sucesso');
    console.log(`   📞 Testando contra Meta Graph API: /${phoneNumberId}`);

    const response = await fetch(
      `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      result.testResult = 'valid';
      result.shouldReactivate = !currentStatus;
      result.phoneNumber = data.display_phone_number;
      result.displayName = data.verified_name;
      
      console.log('   ✅ TOKEN VÁLIDO!');
      console.log(`   📱 Número: ${data.display_phone_number || 'N/A'}`);
      console.log(`   👤 Nome: ${data.verified_name || 'N/A'}`);
      console.log(`   ⭐ Qualidade: ${data.quality_rating || 'N/A'}`);
      
      if (!currentStatus) {
        console.log('   🔄 RECOMENDAÇÃO: REATIVAR esta conexão');
      } else {
        console.log('   ✓ Já está ativa - sem ação necessária');
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      result.testResult = 'expired';
      result.errorMessage = errorData.error?.message || `HTTP ${response.status}`;
      
      console.log(`   ❌ TOKEN INVÁLIDO/EXPIRADO`);
      console.log(`   📋 Erro: ${result.errorMessage}`);
      
      if (currentStatus) {
        console.log('   ⚠️ RECOMENDAÇÃO: DESATIVAR esta conexão');
      }
    }
  } catch (error: any) {
    result.testResult = 'network_error';
    result.errorMessage = error.message || 'Unknown error';
    console.log(`   ❌ Erro de rede/sistema: ${result.errorMessage}`);
  }

  return result;
}

async function reactivateConnection(connectionId: string, configName: string): Promise<boolean> {
  try {
    await db
      .update(connections)
      .set({ isActive: true })
      .where(eq(connections.id, connectionId));
    
    console.log(`   ✅ Conexão "${configName}" REATIVADA com sucesso!`);
    return true;
  } catch (error: any) {
    console.log(`   ❌ Erro ao reativar: ${error.message}`);
    return false;
  }
}

async function deactivateConnection(connectionId: string, configName: string): Promise<boolean> {
  try {
    await db
      .update(connections)
      .set({ isActive: false })
      .where(eq(connections.id, connectionId));
    
    console.log(`   ⚠️ Conexão "${configName}" DESATIVADA (token inválido)`);
    return true;
  } catch (error: any) {
    console.log(`   ❌ Erro ao desativar: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 SCRIPT DE REATIVAÇÃO DE CONEXÕES WHATSAPP');
  console.log('='.repeat(70));
  console.log(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);
  console.log(`🌐 Meta Graph API Version: ${FACEBOOK_API_VERSION}`);
  console.log('='.repeat(70));

  try {
    const allConnections = await db
      .select({
        id: connections.id,
        configName: connections.config_name,
        phoneNumberId: connections.phoneNumberId,
        accessToken: connections.accessToken,
        isActive: connections.isActive,
        connectionType: connections.connectionType,
      })
      .from(connections)
      .orderBy(connections.isActive, connections.config_name);

    console.log(`\n📊 Total de conexões encontradas: ${allConnections.length}`);
    console.log(`   ✅ Ativas: ${allConnections.filter(c => c.isActive).length}`);
    console.log(`   ⚠️ Inativas: ${allConnections.filter(c => !c.isActive).length}`);

    const results: ConnectionTestResult[] = [];

    for (const connection of allConnections) {
      const result = await testWhatsAppConnection(
        connection.id,
        connection.configName,
        connection.phoneNumberId,
        connection.accessToken,
        connection.isActive
      );
      results.push(result);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('📋 RESUMO DOS TESTES');
    console.log('='.repeat(70));

    const validConnections = results.filter(r => r.testResult === 'valid');
    const expiredConnections = results.filter(r => r.testResult === 'expired');
    const failedConnections = results.filter(r => 
      r.testResult === 'decryption_failed' || r.testResult === 'network_error'
    );

    console.log(`\n✅ Tokens Válidos: ${validConnections.length}`);
    validConnections.forEach(r => {
      console.log(`   • ${r.configName} (${r.phoneNumber || 'N/A'})`);
    });

    console.log(`\n❌ Tokens Expirados/Inválidos: ${expiredConnections.length}`);
    expiredConnections.forEach(r => {
      console.log(`   • ${r.configName} - ${r.errorMessage}`);
    });

    console.log(`\n⚠️ Falhas de Sistema: ${failedConnections.length}`);
    failedConnections.forEach(r => {
      console.log(`   • ${r.configName} - ${r.errorMessage}`);
    });

    const toReactivate = results.filter(r => r.shouldReactivate && r.testResult === 'valid');
    const toDeactivate = results.filter(r => r.currentStatus && r.testResult === 'expired');

    if (toReactivate.length === 0 && toDeactivate.length === 0) {
      console.log('\n\n✅ NENHUMA ALTERAÇÃO NECESSÁRIA - Todas as conexões estão com status correto!');
      return;
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('🔄 APLICANDO ALTERAÇÕES');
    console.log('='.repeat(70));

    if (toReactivate.length > 0) {
      console.log(`\n✅ Reativando ${toReactivate.length} conexão(ões):`);
      for (const result of toReactivate) {
        await reactivateConnection(result.id, result.configName);
      }
    }

    if (toDeactivate.length > 0) {
      console.log(`\n⚠️ Desativando ${toDeactivate.length} conexão(ões) com tokens inválidos:`);
      for (const result of toDeactivate) {
        await deactivateConnection(result.id, result.configName);
      }
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('✅ SCRIPT CONCLUÍDO COM SUCESSO');
    console.log('='.repeat(70));
    console.log(`📊 Resumo Final:`);
    console.log(`   • Conexões reativadas: ${toReactivate.length}`);
    console.log(`   • Conexões desativadas: ${toDeactivate.length}`);
    console.log(`   • Total de tokens válidos: ${validConnections.length}`);
    console.log(`   • Total de tokens inválidos: ${expiredConnections.length}`);

  } catch (error: any) {
    console.error('\n\n❌ ERRO CRÍTICO:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
