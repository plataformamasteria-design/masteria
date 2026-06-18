import { Client } from 'pg';
import fs from 'fs';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`SELECT id, name, company_id, visual_data, execution_logic FROM automation_flows WHERE name ILIKE '%GCR%'`);
  for (const row of res.rows) {
    console.log(`Flow ID: ${row.id}, Name: ${row.name}, Company: ${row.company_id}`);
    
    // find nodes in visual_data or execution_logic
    const nodes = row.visual_data?.nodes || row.execution_logic?.nodes || [];
    const fieldsNode = nodes.find((n: any) => n.type === 'customFields');
    if (fieldsNode) {
      console.log('Custom Fields Node Found!');
      fs.writeFileSync('scratch-fields-node.json', JSON.stringify(fieldsNode, null, 2));
    }
    
    const leadNode = nodes.find((n: any) => n.type === 'findLead');
    if (leadNode) {
      console.log('Find Lead Node Found!');
      fs.writeFileSync('scratch-lead-node.json', JSON.stringify(leadNode, null, 2));
    }
    
    fs.writeFileSync(`scratch-flow-${row.id}.json`, JSON.stringify(row, null, 2));
  }

  await client.end();
}

main().catch(console.error);
