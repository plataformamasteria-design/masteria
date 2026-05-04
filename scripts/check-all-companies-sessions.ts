import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq, or, like, and } from 'drizzle-orm';

async function checkAllSessions() {
  console.log('=== 🔍 VERIFICANDO TODAS AS SESSÕES (TODAS AS EMPRESAS) ===');
  console.log('');
  
  // Buscar TODAS as sessões Baileys de TODAS as empresas
  const allSessions = await db.query.connections.findMany({
    where: eq(connections.connectionType, 'baileys'),
  });
  
  console.log('Total de sessões Baileys (todas as empresas):', allSessions.length);
  console.log('');
  
  if (allSessions.length > 0) {
    console.log('Sessões encontradas:');
    allSessions.forEach((s, idx) => {
      console.log(`[${idx + 1}] ${s.config_name}`);
      console.log(`    ID: ${s.id}`);
      console.log(`    Status: ${s.status}`);
      console.log(`    Telefone: ${s.phone || 'N/A'}`);
      console.log(`    Ativo: ${s.isActive}`);
      console.log(`    Empresa: ${s.companyId.substring(0, 8)}...`);
      console.log(`    Última conexão: ${s.lastConnected || 'N/A'}`);
      console.log('');
    });
  } else {
    console.log('✅ Nenhuma sessão Baileys encontrada em NENHUMA empresa');
  }
  
  // Verificar também por nome (caso os dispositivos tenham nomes específicos)
  console.log('=== 🔍 BUSCANDO POR NOMES DE DISPOSITIVOS ===');
  const navNote = await db.query.connections.findMany({
    where: and(
      eq(connections.connectionType, 'baileys'),
      or(
        like(connections.config_name, '%nav%'),
        like(connections.config_name, '%note%'),
        like(connections.config_name, '%master%')
      )
    ),
  });
  
  if (navNote.length > 0) {
    console.log('Sessões com nomes similares encontradas:');
    navNote.forEach(s => {
      console.log('  -', s.config_name, '|', s.status);
    });
  } else {
    console.log('✅ Nenhuma sessão com nomes similares encontrada');
  }
  
  // Verificar se há servidor de produção rodando
  console.log('');
  console.log('=== ⚠️ POSSÍVEIS CAUSAS ===');
  console.log('');
  console.log('Se o WhatsApp ainda mostra dispositivos conectados, pode ser:');
  console.log('1. Servidor de PRODUÇÃO rodando em paralelo');
  console.log('2. Outro servidor/instância com sessões ativas');
  console.log('3. Cache do WhatsApp (pode levar alguns minutos para sincronizar)');
  console.log('4. Sessões conectadas através de outro sistema/API');
  console.log('');
  console.log('💡 SOLUÇÃO:');
  console.log('   Desconectar manualmente no WhatsApp:');
  console.log('   Configurações → Aparelhos conectados → Remover dispositivo');
  
  process.exit(0);
}

checkAllSessions();
