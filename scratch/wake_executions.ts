import { db } from '../src/lib/db';
import { automationFlowExecutions } from '../src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const executions = await db.select()
    .from(automationFlowExecutions)
    .where(eq(automationFlowExecutions.status, 'delayed'));
    
  let fixed = 0;
  for (const exec of executions) {
      if (exec.variables && typeof exec.variables === 'object' && (exec.variables as any)._resumeAt) {
          const resumeAt = new Date((exec.variables as any)._resumeAt);
          const now = new Date();
          // Se o resumeAt for pro dia seguinte ou mais e tiver passado a hora que deveria ser executado no BRT
          // Nós simplesmente forçamos para executar agora.
          if (resumeAt.getTime() > now.getTime() + 1000 * 60 * 60 * 5) {
               console.log(`Forcing execution ${exec.id} to wake up now...`);
               const vars = { ...exec.variables as any, _resumeAt: now.getTime() - 1000 };
               await db.update(automationFlowExecutions).set({ variables: vars }).where(eq(automationFlowExecutions.id, exec.id));
               fixed++;
          }
      }
  }
  
  console.log(`Fixed ${fixed} stuck executions. The cron job will pick them up within a minute.`);
  process.exit(0);
}

main().catch(console.error);
