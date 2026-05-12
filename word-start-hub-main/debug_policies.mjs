import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/SUPABASE_ACCESS_TOKEN=(.*)/)?.[1]?.replace(/['"]/g, '').trim();
const projectId = env.match(/VITE_SUPABASE_PROJECT_ID=(.*)/)?.[1]?.replace(/['"]/g, '').trim();

async function run() {
    const sql = `
SELECT policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'whatsapp_connections';
    `;

    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ query: sql }),
    });
    console.log(await resp.text());
}
run();
