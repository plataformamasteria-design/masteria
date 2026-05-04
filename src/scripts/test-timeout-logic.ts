import { db } from '@/lib/db';
import { automationFlowExecutions, automationFlows, contacts, companies } from '@/lib/db/schema';
import { processTimeouts } from '@/workers/automation-timeout.worker';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

async function runTest() {
  console.log('🧪 Iniciando teste do worker de timeout...');

  const firstCompany = await db.query.companies.findFirst();
  if (!firstCompany) {
    console.error('Nenhuma company encontrada no DB.');
    process.exit(1);
  }

  // 1. Criar um fluxo de mentirinha com um nó AI_Agent e o caminho "timeout"
  const mockFlowId = uuidv4();
  const mockCompanyId = firstCompany.id;
  
  await db.insert(automationFlows).values({
    id: mockFlowId,
    name: 'TESTE TIMEOUT AI AGENT',
    companyId: mockCompanyId,
    status: 'published',
    isActive: true,
    visualData: {},
    executionLogic: {
      steps: [
        {
          id: 'step-trigger',
          type: 'trigger',
          data: { triggerType: 'manual' }
        },
        {
          id: 'step-ai',
          type: 'ai_agent',
          data: { 
            dialogue_mode: true, 
            timeout_enabled: true, 
            timeout_amount: 1, 
            timeout_unit: 'minutes' 
          }
        },
        {
          id: 'step-timeout-msg',
          type: 'send_message',
          data: { text: 'O tempo esgotou!' }
        }
      ],
      edges: [
        { source: 'step-trigger', target: 'step-ai' },
        { source: 'step-ai', target: 'step-timeout-msg', sourceHandle: 'timeout' }
      ]
    }
  });

  // 2. Criar um contato mock
  const mockContactId = uuidv4();
  await db.insert(contacts).values({
    id: mockContactId,
    companyId: mockCompanyId,
    name: 'Contato Teste Timeout',
    phone: '5511999999999',
  });

  // 3. Criar a execução PAUSADA do fluxo, com _ai_timeout_at no passado
  const mockExecutionId = uuidv4();
  await db.insert(automationFlowExecutions).values({
    id: mockExecutionId,
    companyId: mockCompanyId,
    contactId: mockContactId,
    flowId: mockFlowId,
    status: 'paused',
    currentStepId: 'step-ai',
    variables: {
      vars: {
        _ai_timeout_at: Date.now() - 10000, // 10 segundos atrás
        _ai_step_id: 'step-ai'
      }
    }
  });

  console.log('✅ Dados de teste inseridos. Invocando worker...');

  // 4. Executar o worker
  await processTimeouts();

  // 5. Verificar o resultado
  const execResult = await db.query.automationFlowExecutions.findFirst({
    where: eq(automationFlowExecutions.id, mockExecutionId)
  });

  console.log('\n--- RESULTADO ---');
  if (execResult) {
    console.log(`Status Final: ${execResult.status}`);
    console.log(`Variáveis Restantes:`, JSON.stringify(execResult.variables, null, 2));
    
    if (execResult.status === 'completed' || execResult.status === 'running') {
      console.log('✅ SUCESSO! A execução foi destravada com sucesso pelo worker.');
    } else {
      console.log('❌ FALHA. O status não foi alterado corretamente.');
    }
  }

  // 6. Limpar o banco de dados
  console.log('\n🧹 Limpando dados do teste...');
  await db.delete(automationFlowExecutions).where(eq(automationFlowExecutions.id, mockExecutionId));
  await db.delete(contacts).where(eq(contacts.id, mockContactId));
  await db.delete(automationFlows).where(eq(automationFlows.id, mockFlowId));
  console.log('✅ Limpeza concluída.');

  process.exit(0);
}

runTest().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
