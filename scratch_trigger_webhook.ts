import { evaluateWebhookTriggers } from './src/lib/flow-engine';
import { db } from './src/lib/db';

async function run() {
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
  
  const payload = {
    "body": {
      "form": {
        "form_name": "Aplicação - 7° EDN Encontro de Negócios Alphaville (Antônio)",
        "form_id": "gLii6RAu"
      },
      "respondent": {
        "status": "completed",
        "date": "2026-05-21 14:54:12",
        "score": 27,
        "respondent_id": "7fb2c757-753c-4d6d-9348-c886d4c09e7d",
        "answers": {
          "Qual seu nome?": "Deivid Resubmitted",
          "Qual seu Whatsapp?": "55 88920008007",
          "Qual o seu melhor e-mail?": "teste_resub@teste.com",
          "Qual o seu cargo na empresa?": "Presidente ou CEO",
          "Qual o @ do seu Instagram?": "teste",
          "Quantos colaboradores você tem na sua empresa atualmente?": "10-25",
          "Qual é o seu nicho/área de atuação?": "Marketing",
          "Qual o seu principal objetivo no Encontro de Negócio do Antonio Fogaça com Pablo Marçal?": "teste resolucao bug",
          "E qual o faturamento médio mensal da sua empresa?": "De R$ 100 mil a R$ 200 mil / mês",
          "O Encontro de Negócios é um evento presencial que acontece no Alphaville SP, valor do Investimento é a partir R$ 497, qual opção você prefere?": "Nenhuma das alternativas"
        }
      }
    }
  };

  console.log("Triggering flow with payload...");
  await evaluateWebhookTriggers(companyId, null as any, 'webhook', payload);
  console.log("Trigger done. Waiting 5s for flow execution...");
  await new Promise(r => setTimeout(r, 5000));
  
  // Verify contact update
  const contact = await db.query.contacts.findFirst({
    where: (c, {eq, and}) => and(eq(c.companyId, companyId), eq(c.phone, '+5588920008007'))
  });
  
  console.log("Updated Contact:", JSON.stringify(contact, null, 2));
}

run().catch(console.error).finally(()=>process.exit(0));
