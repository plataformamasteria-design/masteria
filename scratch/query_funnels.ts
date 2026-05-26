require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/lib/db');
  const { companies, kanbanBoards } = await import('../src/lib/db/schema');
  const { eq, ilike } = await import('drizzle-orm');

  const company = await db.query.companies.findFirst({
    where: ilike(companies.name, '%Empresa de Desenvolvimento Master%')
  });

  if (!company) {
    console.log('Company not found!');
    process.exit(1);
  }

  console.log('Company:', company.id, company.name);

  const boards = await db.query.kanbanBoards.findMany({
    where: eq(kanbanBoards.companyId, company.id)
  });

  console.log('Boards:');
  for (const b of boards) {
    console.log(`- ${b.id} | ${b.name} | First stage: ${b.stages[0]?.title} (${b.stages[0]?.id})`);
  }
  process.exit(0);
}
main().catch(console.error);
