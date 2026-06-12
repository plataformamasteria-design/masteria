import { db } from '@/lib/db';
import { automationFlowExecutions, automationFlows, conversations } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { processFlowExecution } from '@/lib/flow-engine';

const POLLING_INTERVAL_MS = 60000; // Check every minute

let pollingInterval: NodeJS.Timeout | null = null;
let isProcessing = false;
let isInitialized = false;
let shutdownHandlersRegistered = false;

declare global {
  // eslint-disable-next-line no-var
  var __automationTimeoutWorkerInitialized: boolean | undefined;
  // eslint-disable-next-line no-var
  var __automationTimeoutShutdownRegistered: boolean | undefined;
  // eslint-disable-next-line no-var
  var __automationTimeoutPollingInterval: NodeJS.Timeout | undefined;
}

function registerShutdownHandlers(): void {
  if (global.__automationTimeoutShutdownRegistered || shutdownHandlersRegistered) {
    return;
  }

  const gracefulShutdown = async (signal: string) => {
    console.log(`[AutomationTimeoutWorker] 🛑 Recebido ${signal}, encerrando...`);
    await shutdownAutomationTimeoutWorker();
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  shutdownHandlersRegistered = true;
  global.__automationTimeoutShutdownRegistered = true;
  console.log('[AutomationTimeoutWorker] 🔧 Registered shutdown handlers');
}

async function processTimeouts(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = Date.now();
    
    // Find all paused executions
    const pausedExecutions = await db.query.automationFlowExecutions.findMany({
      where: eq(automationFlowExecutions.status, 'paused'),
      columns: {
        id: true,
        variables: true,
        currentStepId: true,
        flowId: true,
      }
    });

    let processedCount = 0;

    for (const exec of pausedExecutions) {
      const execVarsRoot = (exec.variables as any) || {};
      const vars = execVarsRoot.vars || {};
      
      const aiTimeout = vars._ai_timeout_at ? parseInt(vars._ai_timeout_at) : null;
      const waitTimeout = vars._wait_timeout_at ? parseInt(vars._wait_timeout_at) : null;
      const resumeAt = execVarsRoot._resumeAt ? parseInt(execVarsRoot._resumeAt) : null;

      const hasAiTimeout = aiTimeout && aiTimeout < now;
      const hasWaitTimeout = waitTimeout && waitTimeout < now;
      const hasDelayTimeout = resumeAt && resumeAt < now;

      if (hasAiTimeout || hasWaitTimeout || hasDelayTimeout) {
        processedCount++;
        
        // Define which step triggered the timeout
        const stepId = (hasAiTimeout ? vars._ai_step_id : (hasWaitTimeout ? vars._wait_step_id : exec.currentStepId)) || exec.currentStepId;
        
        console.log(`[AutomationTimeoutWorker] ⏰ Timeout reached for execution ${exec.id} at step ${stepId}`);

        // 🚨 NOVO: VERIFICAR SE O ROBO FOI DESATIVADO NA CONVERSA
        const conversationId = vars._conversation_id || vars.conversationId || execVarsRoot.conversationId;
        if (conversationId) {
            const conv = await db.query.conversations.findFirst({
               where: eq(conversations.id, conversationId)
            });
            if (conv && conv.aiActive === false) {
                console.log(`[AutomationTimeoutWorker] 🛑 Execução ${exec.id} abortada no passo ${stepId}. A chave "IA Ativa" foi desligada manualmente pelo operador.`);
                await db.update(automationFlowExecutions)
                  .set({ status: 'failed', error: 'Automação cancelada pois a IA foi desativada pelo operador' })
                  .where(eq(automationFlowExecutions.id, exec.id));
                continue; // Pular para a próxima execução sem retomar o fluxo
            }
        }

        // Update context to trigger timeout bypass and clear timeout flags
        vars._timeout_triggered_for_step = stepId;
        if (hasAiTimeout) {
          delete vars._ai_timeout_at;
          delete vars._ai_step_id;
        }
        if (hasWaitTimeout) {
          delete vars._wait_timeout_at;
          delete vars._wait_step_id;
        }
        if (hasDelayTimeout) {
          delete execVarsRoot._resumeAt;
        }

        // Set back to running
        await db.update(automationFlowExecutions)
          .set({ status: 'running', variables: { ...execVarsRoot, vars } })
          .where(eq(automationFlowExecutions.id, exec.id));

        // Get the flow logic
        const flow = await db.query.automationFlows.findFirst({
          where: eq(automationFlows.id, exec.flowId),
          columns: { executionLogic: true, isActive: true }
        });

        if (flow && flow.isActive && flow.executionLogic) {
          // 🚨 ORPHAN NODE PROTECTION: Verify if the node still exists before resuming
          const logic = flow.executionLogic as any;
          const steps = Array.isArray(logic) ? logic : logic?.steps;
          const stepExists = steps?.some((s: any) => s.id === stepId);

          if (!stepExists) {
              console.log(`[AutomationTimeoutWorker] 🛑 Execução ${exec.id} falhou. Nó de origem ${stepId} não existe mais no fluxo.`);
              await db.update(automationFlowExecutions)
                  .set({ status: 'failed', error: `Nó de origem (${stepId}) deletado ou não encontrado no fluxo.` })
                  .where(eq(automationFlowExecutions.id, exec.id));
              continue;
          }

          // Resume execution
          processFlowExecution(exec.id, flow.executionLogic as any, stepId)
            .catch(err => console.error(`[AutomationTimeoutWorker] Error resuming flow ${exec.id}:`, err));
        } else {
          // Flow inactive or deleted
          await db.update(automationFlowExecutions)
            .set({ status: 'failed', error: 'Flow inactive or missing logic on timeout' })
            .where(eq(automationFlowExecutions.id, exec.id));
        }
      }
    }

    if (processedCount > 0) {
      console.log(`[AutomationTimeoutWorker] ✅ Processed ${processedCount} timed-out executions.`);
    }

  } catch (error) {
    console.error('[AutomationTimeoutWorker] ❌ Error checking timeouts:', error);
  } finally {
    isProcessing = false;
  }
}

async function initializeAutomationTimeoutWorker(): Promise<boolean> {
  if (global.__automationTimeoutWorkerInitialized) {
    console.log('[AutomationTimeoutWorker] Worker já inicializado (hot-reload detectado).');
    return true;
  }

  if (isInitialized) return true;

  try {
    registerShutdownHandlers();

    if (global.__automationTimeoutPollingInterval) {
      clearInterval(global.__automationTimeoutPollingInterval);
    }

    await processTimeouts();

    pollingInterval = setInterval(processTimeouts, POLLING_INTERVAL_MS);
    global.__automationTimeoutPollingInterval = pollingInterval;

    isInitialized = true;
    global.__automationTimeoutWorkerInitialized = true;

    console.log(`[AutomationTimeoutWorker] ✅ Worker iniciado com sucesso. Polling a cada ${POLLING_INTERVAL_MS / 1000}s`);
    return true;
  } catch (error) {
    console.error('[AutomationTimeoutWorker] ❌ Falha ao inicializar:', error);
    return false;
  }
}

async function shutdownAutomationTimeoutWorker(): Promise<void> {
  console.log('[AutomationTimeoutWorker] 🛑 Encerrando worker...');
  try {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }

    if (global.__automationTimeoutPollingInterval) {
      clearInterval(global.__automationTimeoutPollingInterval);
      global.__automationTimeoutPollingInterval = undefined;
    }

    isInitialized = false;
    global.__automationTimeoutWorkerInitialized = false;
    console.log('[AutomationTimeoutWorker] ✅ Worker encerrado com sucesso.');
  } catch (error) {
    console.error('[AutomationTimeoutWorker] ❌ Erro ao encerrar worker:', error);
  }
}

export {
  initializeAutomationTimeoutWorker,
  shutdownAutomationTimeoutWorker,
  processTimeouts
};
