import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.replace(/['"]/g, '').trim();
const sa_key = env.match(/SUPABASE_ACCESS_TOKEN=(.*)/)?.[1]?.replace(/['"]/g, '').trim();

// To simulate deletion properly, we should see if there is ANY DB constraint
const sql = `
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE ccu.table_name = 'whatsapp_connections';
`;

async function run() {
    const projectId = url.split('.')[0].split('//')[1];

    // First query to check FK attached TO whatsapp_connections
    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sa_key },
        body: JSON.stringify({ query: sql }),
    });

    console.log('FKs referencing whatsapp_connections:', await resp.text());
}
run();
