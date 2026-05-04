
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { configureCallingSettings, getCallingSettings } from '@/lib/facebookApiService';
import { eq } from 'drizzle-orm';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  console.log('🚀 Configuração de Chamadas WhatsApp (Graph API)');
  console.log('------------------------------------------------');

  const allConnections = await db.select().from(connections).where(eq(connections.connectionType, 'meta_api'));
  
  if (allConnections.length === 0) {
    console.error('❌ Nenhuma conexão WhatsApp Cloud API encontrada.');
    process.exit(1);
  }

  console.log('Conexões disponíveis:');
  allConnections.forEach((conn, idx) => {
    console.log(`${idx + 1}. ${conn.config_name} (${conn.phoneNumberId})`);
  });

  rl.question('\nSelecione o número da conexão (1-' + allConnections.length + '): ', async (answer) => {
    const index = parseInt(answer) - 1;
    if (isNaN(index) || index < 0 || index >= allConnections.length) {
      console.error('Seleção inválida.');
      process.exit(1);
    }

    const connection = allConnections[index];
    console.log(`\nSelecionado: ${connection.config_name}`);

    try {
      console.log('1. Habilitar Chamadas (Status: ENABLED)');
      console.log('2. Desabilitar Chamadas (Status: DISABLED)');
      console.log('3. Verificar Status Atual');
      
      rl.question('Escolha uma ação: ', async (action) => {
        if (action === '3') {
          const settings = await getCallingSettings(connection.id);
          console.log('\nConfigurações Atuais:', JSON.stringify(settings, null, 2));
        } else if (action === '1' || action === '2') {
          const enabled = action === '1';
          console.log(`\n${enabled ? 'Habilitando' : 'Desabilitando'} chamadas...`);
          
          await configureCallingSettings(connection.id, {
            calling: {
              status: enabled ? 'ENABLED' : 'DISABLED',
              sip: { status: 'DISABLED' }, // Garantir que SIP está desligado para usar Graph API/App
              call_icon_visibility: enabled ? 'DEFAULT' : 'NEVER_SHOW'
            }
          });
          
          console.log('✅ Configuração atualizada com sucesso!');
        } else {
          console.log('Ação inválida.');
        }
        process.exit(0);
      });

    } catch (error) {
      console.error('❌ Erro:', error);
      process.exit(1);
    }
  });
}

main().catch(console.error);
