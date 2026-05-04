
import { db } from '@/lib/db';
import { connections, companies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { SessionMonitor } from '@/lib/baileys/session-monitor';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log('🧪 Iniciando Teste de Lógica do Session Monitor...');

  // 1. Criar uma empresa de teste (se não existir)
  const testCompanyId = 'test-company-' + uuidv4().slice(0, 8);
  // Não vamos inserir empresa real para não sujar muito, vamos usar uma existente ou mockar
  // Melhor usar uma existente para respeitar FKs
  const [company] = await db.select().from(companies).limit(1);
  if (!company) throw new Error('Nenhuma empresa encontrada');
  
  console.log(`🏢 Usando empresa: ${company.name} (${company.id})`);

  // 2. Criar uma conexão "falsa" desconectada mas ativa
  const testConnectionId = uuidv4();
  console.log(`🔌 Criando conexão de teste: ${testConnectionId}`);
  
  await db.insert(connections).values({
    id: testConnectionId,
    companyId: company.id,
    config_name: 'TEST-SESSION-MONITOR',
    connectionType: 'baileys',
    isActive: true, // Importante: deve ser ativa
    status: 'disconnected', // Importante: desconectada
    createdAt: new Date(),
    updatedAt: new Date()
  } as any);

  try {
    console.log('👀 Verificando estado inicial...');
    const [initialState] = await db.select().from(connections).where(eq(connections.id, testConnectionId));
    if (!initialState) throw new Error('Failed to create initial state');

    console.log(`   Status: ${initialState.status}, IsActive: ${initialState.isActive}`);

    // 3. Executar o Monitor
    console.log('🏃 Executando SessionMonitor.checkAndRecoverSessions()...');
    const monitor = SessionMonitor.getInstance();
    
    // Capturar logs para verificar se ele tentou recuperar
    // Nota: O monitor real vai tentar chamar sessionManager.ensureSession
    // Como não tem arquivos de auth para esse ID, vai falhar e logar erro, ou mudar status para needs_qr
    // Isso é o esperado!
    
    await monitor.checkAndRecoverSessions();

    // 4. Verificar resultado
    // Como não temos auth files, o ensureSession deve retornar { success: false, status: 'needs_qr' }
    // O monitor deve ter logado a tentativa.
    
    console.log('✅ Execução concluída. Verifique os logs acima para confirmar a tentativa de recuperação.');
    console.log('ℹ️ O comportamento esperado é: "Falha ao recuperar sessão... No authentication found"');

  } catch (err) {
    console.error('❌ Erro no teste:', err);
  } finally {
    // 5. Limpeza
    console.log('🧹 Limpando dados de teste...');
    await db.delete(connections).where(eq(connections.id, testConnectionId));
    console.log('✨ Teste finalizado.');
  }
}

main().catch(console.error);
