import 'dotenv/config';
import { db } from './src/lib/db';
import { automationFlowExecutions, companies, automationFlows, contacts } from './src/lib/db/schema';
import { ilike, eq, and } from 'drizzle-orm';

async function checkAtivarRoboExec() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  const deivid = await db.query.contacts.findFirst({
    where: ilike(contacts.name, '%Deivid%Rodrigues%')
  });

  const flow = await db.query.automationFlows.findFirst({
    where: and(eq(automationFlows.companyId, company!.id), ilike(automationFlows.name, '%ATIVAR ROBO%'))
  });

  const execs = await db.query.automationFlowExecutions.findMany({
    where: and(
      eq(automationFlowExecutions.flowId, flow!.id),
      eq(automationFlowExecutions.contactId, deivid!.id)
    ),
    orderBy: (t, { desc }) => [desc(t.startedAt)],
    limit: 5
  });

  console.log(`Execuções de ATIVAR ROBO para Deivid:`);
  for (const ex of execs) {
    console.log(`Status: ${ex.status} | Step: ${ex.currentStepId} | Start: ${ex.startedAt} | Error: ${ex.error}`);
  }
  process.exit(0);
}

checkAtivarRoboExec().catch(console.error);
