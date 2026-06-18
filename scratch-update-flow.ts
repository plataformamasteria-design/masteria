import { Client } from 'pg';
import fs from 'fs';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const flowId = '1cb3a720-c816-4c77-bc83-7e1df0678de7';
  const res = await client.query(`SELECT visual_data, execution_logic FROM automation_flows WHERE id = $1`, [flowId]);
  
  if (res.rows.length === 0) {
    console.error('Flow not found');
    process.exit(1);
  }

  const flow = res.rows[0];
  const visualData = flow.visual_data;
  const executionLogic = flow.execution_logic;

  const fieldsToMap = [
    { name: "nome", value: "{{body.respondent.answers.Qual seu nome?}}" },
    { name: "email", value: "{{body.respondent.answers.Qual o seu melhor e-mail?}}" },
    { name: "faturamento", value: "{{body.respondent.answers.E qual o faturamento médio mensal da sua empresa?}}" },
    { name: "utm_source", value: "{{body.respondent.respondent_utms.utm_source}}" },
    { name: "utm_medium", value: "{{body.respondent.respondent_utms.utm_medium}}" },
    { name: "utm_campaign", value: "{{body.respondent.respondent_utms.utm_campaign}}" },
    { name: "utm_term", value: "{{body.respondent.respondent_utms.utm_term}}" },
    { name: "utm_content", value: "{{body.respondent.respondent_utms.utm_content}}" }
  ];

  // Update visual_data nodes
  if (visualData && visualData.nodes) {
    const updateNode = visualData.nodes.find((n: any) => n.type === 'update_contact');
    if (updateNode) {
      updateNode.data.fields = fieldsToMap;
    }
  }

  // Update execution_logic array
  if (executionLogic && Array.isArray(executionLogic)) {
    const updateNode = executionLogic.find((n: any) => n.type === 'update_contact');
    if (updateNode) {
      updateNode.data.fields = fieldsToMap;
    }
  }

  await client.query(`UPDATE automation_flows SET visual_data = $1, execution_logic = $2 WHERE id = $3`, [JSON.stringify(visualData), JSON.stringify(executionLogic), flowId]);
  
  console.log('Flow updated successfully.');
  await client.end();
}

main().catch(console.error);
