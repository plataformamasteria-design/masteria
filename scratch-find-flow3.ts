import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`SELECT id, name, company_id, nodes FROM automation_flows WHERE name ILIKE '%GCR%'`);
  for (const row of res.rows) {
    console.log(`Flow ID: ${row.id}, Name: ${row.name}, Company: ${row.company_id}`);
    const fieldsNode = row.nodes.find((n: any) => n.type === 'customFields');
    if (fieldsNode) {
      console.log('Custom Fields Node:');
      console.log(JSON.stringify(fieldsNode, null, 2));
    }
  }

  await client.end();
}

main().catch(console.error);
