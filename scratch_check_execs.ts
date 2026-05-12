import 'dotenv/config';
import { db } from './src/lib/db';
import { automationFlowExecutions, companies, automationFlows } from './src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function checkExec() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  if (!company) {
    console.log("Companhia não encontrada.");
    process.exit(0);
  }

  const flows = await db.query.automationFlows.findMany({
    where: eq(automationFlows.companyId, company.id)
  });

  const execs = await db.query.automationFlowExecutions.findMany({
    where: eq(automationFlowExecutions.companyId, company.id),
    orderBy: (t, { desc }) => [desc(t.startedAt)],
    limit: 10
  });

  console.log(`Últimas 10 execuções:`);
  for (const ex of execs) {
    const flow = flows.find(f => f.id === ex.flowId);
    console.log(`Flow: ${flow?.name} | Status: ${ex.status} | Step: ${ex.currentStepId} | Start: ${ex.startedAt}`);
  }
  process.exit(0);
}

checkExec().catch(console.error);
