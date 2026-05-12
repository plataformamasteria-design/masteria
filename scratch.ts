import { db } from './src/lib/db';
import { companies, automationFlows, contacts, automationFlowExecutions } from './src/lib/db/schema';
import { eq, and, like } from 'drizzle-orm';

async function run() {
    const matchedCompanies = await db.query.companies.findMany({
        where: (companies, { like }) => like(companies.name, '%Douglas%')
    });
    if (matchedCompanies.length === 0) {
        console.log("No companies found with Douglas");
        process.exit(1);
    }
    const company = matchedCompanies[0];
    console.log("Company ID:", company.id, "Name:", company.name);

    const flows = await db.query.automationFlows.findMany({
        where: (flow, { eq }) => eq(flow.companyId, company.id)
    });
    console.log("Flows:", flows.map(f => ({ id: f.id, name: f.name, isActive: f.isActive, logic: JSON.stringify(f.executionLogic).substring(0, 100) + '...' })));

    const matchedContacts = await db.query.contacts.findMany({
        where: (contact, { and, eq, like }) => and(eq(contact.companyId, company.id), like(contact.name, '%Deivid%'))
    });
    
    for (const contact of matchedContacts) {
        console.log("\nContact ID:", contact?.id, "Phone:", contact?.phone, "Name:", contact?.name);

        const execs = await db.query.automationFlowExecutions.findMany({
            where: (exec, { eq }) => eq(exec.contactId, contact.id),
            limit: 15
        });
        
        execs.sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0));

        console.log("Executions:", execs.slice(0,5).map(e => ({ id: e.id, flowId: e.flowId, status: e.status, currentStep: e.currentStepId, startedAt: e.startedAt, finishedAt: e.finishedAt, vars: JSON.stringify(e.variables).substring(0, 100) })));
    }
    process.exit(0);
}
run();
