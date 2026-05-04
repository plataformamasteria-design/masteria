
import { db } from '../src/lib/db';
import { users, aiPersonas, companies } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function verifyAndRestoreDiegoAgent() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  VERIFICAÇÃO DE AGENTES: diegomaninhu@gmail.com                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const email = 'diegomaninhu@gmail.com';

  // 1. Encontrar usuário e empresa
  const [user] = await db.select().from(users).where(eq(users.email, email));
  
  if (!user) {
    console.error(`❌ Usuário ${email} não encontrado.`);
    return;
  }

  if (!user.companyId) {
    console.error(`❌ Usuário ${email} não tem empresa associada.`);
    return;
  }

  const [company] = await db.select().from(companies).where(eq(companies.id, user.companyId));
  console.log(`✅ Usuário encontrado: ${user.name}`);
  console.log(`🏢 Empresa: ${company?.name} (ID: ${user.companyId})`);

  // 2. Verificar Agentes da Empresa
  const agents = await db.select().from(aiPersonas).where(eq(aiPersonas.companyId, user.companyId));
  console.log(`\n🤖 Agentes encontrados: ${agents.length}`);

  agents.forEach(agent => {
    console.log(`   - [${agent.id}] ${agent.name} (Ativo: ${agent.isActive})`);
  });

  if (agents.length === 0) {
    console.log('\n⚠️  Nenhum agente encontrado! Iniciando restauração de emergência...');
    
    // Tentar restaurar agente padrão se não existir
    const newAgentId = crypto.randomUUID();
    await db.insert(aiPersonas).values({
      id: newAgentId,
      companyId: user.companyId,
      name: 'Assistente Padrão',
      prompt: 'Você é um assistente útil e amigável.',
      isActive: true,
      provider: 'google', // Default para evitar problemas de credenciais
      model: 'gemini-pro',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`✅ Agente "Assistente Padrão" restaurado com ID: ${newAgentId}`);
  } else {
    // Se existem agentes mas não aparecem, pode ser o campo isActive
    const inactiveAgents = agents.filter(a => !a.isActive);
    if (inactiveAgents.length > 0) {
      console.log(`\n⚠️  Encontrados ${inactiveAgents.length} agentes INATIVOS. Reativando...`);
      for (const agent of inactiveAgents) {
        await db.update(aiPersonas)
          .set({ isActive: true })
          .where(eq(aiPersonas.id, agent.id));
        console.log(`   🔄 Agente "${agent.name}" reativado.`);
      }
    } else {
        console.log('\n✅ Todos os agentes parecem estar ativos no banco de dados.');
    }
  }
}

verifyAndRestoreDiegoAgent().catch(console.error);
