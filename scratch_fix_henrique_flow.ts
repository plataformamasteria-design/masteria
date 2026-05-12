import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './src/lib/db';
import { automationFlows, companies } from './src/lib/db/schema';
import { eq, and, ilike } from 'drizzle-orm';

async function fix() {
  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Henrique%Felipe%')
  });

  if (!company) {
    console.log("Empresa não encontrada.");
    process.exit(1);
  }

  const result = await db.update(automationFlows)
    .set({ isActive: false })
    .where(
      and(
        eq(automationFlows.companyId, company.id),
        eq(automationFlows.name, 'ATIVAR ROBO')
      )
    )
    .returning();

  console.log(`Desativados ${result.length} fluxos.`);
  for (const f of result) {
    console.log(`Flow: ${f.name} (ID: ${f.id}) -> isActive: ${f.isActive}`);
  }

  process.exit(0);
}
fix().catch(console.error);
