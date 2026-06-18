import postgres from 'postgres';
import 'dotenv/config';

async function check() {
  const sql = postgres(process.env.DATABASE_URL!);
  
  // Find lead Deivid Rodrigues
  const contacts = await sql`SELECT id, name FROM contacts WHERE name ILIKE '%Deivid Rodrigues%' LIMIT 10`;
  console.log('Contacts:', contacts);
  
  if (contacts.length > 0) {
    const contactIds = contacts.map(c => c.id);
    const logs = await sql`SELECT node_type, status, message, input_data, output_data FROM automation_execution_logs WHERE execution_id IN (SELECT id FROM automation_flow_executions WHERE contact_id = ANY(${contactIds})) ORDER BY created_at DESC LIMIT 5`;
    console.log('Logs:', logs);
  }
  
  await sql.end();
}

check();
