import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { kanbanBoards, companies } from '../src/lib/db/schema';
import crypto from 'crypto';
import { eq, and, or } from 'drizzle-orm';

const TARGET_IDENTIFIER = 'f28e5adf-ce84-436b-94c5-cd3941f254b7';
const FUNNEL_NAME = 'FUNIL EDN [ATUAL]';

const RAW_STAGES = [
  "Lead Novo",
  "Venda perdida (Contato Inexistente)",
  "Tent Contato 01",
  "Venda perdida (Teste Mkt)",
  "NEGOCIAÇão",
  "Reunião agendada",
  "Venda perdida (Indisponibilidade de data)",
  "Venda perdida (Não é ICP)",
  "Venda perdida (Deslocamento)",
  "Tent Contato 02",
  "Tent Contato 04",
  "Venda perdida (Sem interesse)",
  "Venda perdida (Sem faturamento)",
  "Venda ganha",
  "Venda perdida (Sem contato)",
  "Venda perdida (Duplicado)",
  "Reagendamento Reunião",
  "Venda perdida",
  "Tent Contato 03",
  "Venda perdida (Não conectou)",
  "Venda perdida (Está com outro closer)",
  "Tent Contato 05",
  "Venda perdida (Contato Pessoal)"
];

const mappedStages = RAW_STAGES.map(stage => {
  let type: 'NEUTRAL' | 'WIN' | 'LOSS' = 'NEUTRAL';
  let semanticType;

  if (stage.toLowerCase().includes('ganha')) {
    type = 'WIN';
    semanticType = 'payment_received';
  } else if (stage.toLowerCase().includes('perdida')) {
    type = 'LOSS';
  } else if (stage.toLowerCase().includes('reunião agendada')) {
    semanticType = 'meeting_scheduled';
  }

  return {
    id: crypto.randomUUID(),
    title: stage,
    type,
    semanticType
  };
});

async function createStructure() {
  console.log(`Conectando ao banco de dados...`);
  const sql = postgres(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log(`Buscando empresa pelo identificador (ID ou Slug): ${TARGET_IDENTIFIER}...`);
  const company = await db.select().from(companies).where(
    or(
      eq(companies.id, TARGET_IDENTIFIER),
      eq(companies.webhookSlug, TARGET_IDENTIFIER)
    )
  ).limit(1);

  if (company.length === 0) {
    console.error(`❌ Empresa não encontrada pelo ID ou Slug: ${TARGET_IDENTIFIER}`);
    process.exit(1);
  }
  
  const COMPANY_ID = company[0].id;
  console.log(`Empresa encontrada: ${company[0].name} (ID: ${COMPANY_ID})`);

  console.log(`Verificando existência do Kanban Board "${FUNNEL_NAME}" para a empresa ${COMPANY_ID}...`);
  
  const existingBoard = await db.select().from(kanbanBoards).where(
    and(
      eq(kanbanBoards.companyId, COMPANY_ID),
      eq(kanbanBoards.name, FUNNEL_NAME)
    )
  ).limit(1);

  if (existingBoard.length > 0) {
    console.log(`Funil "${FUNNEL_NAME}" já existe com ID: ${existingBoard[0].id}`);
    console.log("Nenhuma ação necessária.");
    process.exit(0);
  }

  console.log("Criando novo Kanban Board...");
  const [newBoard] = await db.insert(kanbanBoards).values({
    companyId: COMPANY_ID,
    name: FUNNEL_NAME,
    stages: mappedStages
  }).returning();

  console.log(`✅ Kanban Board criado com sucesso! ID: ${newBoard.id}`);
  process.exit(0);
}

createStructure().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
