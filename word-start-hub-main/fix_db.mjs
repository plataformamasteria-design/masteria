import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/SUPABASE_ACCESS_TOKEN=(.*)/)?.[1]?.replace(/['"]/g, '').trim();
const projectId = env.match(/VITE_SUPABASE_PROJECT_ID=(.*)/)?.[1]?.replace(/['"]/g, '').trim();

async function run() {
    const sql = `
DO $$
BEGIN
    -- Drop constraints if they exist
    ALTER TABLE IF EXISTS whatsapp_connections DROP CONSTRAINT IF EXISTS whatsapp_connections_organization_id_key;
    ALTER TABLE IF EXISTS whatsapp_connections DROP CONSTRAINT IF EXISTS whatsapp_connections_organization_id_key1;

    -- Drop and recreate the policy correctly matching the other RLS policies
    DROP POLICY IF EXISTS "Users can delete connections of their organization" ON public.whatsapp_connections;
    DROP POLICY IF EXISTS "Admins can delete organization whatsapp_connections" ON public.whatsapp_connections;

    CREATE POLICY "Admins can delete organization whatsapp_connections" 
    ON public.whatsapp_connections FOR DELETE 
    USING (((has_role(auth.uid(), 'admin'::app_role) AND (organization_id = get_user_organization_id(auth.uid()))) OR is_super_admin(auth.uid())));
END $$;
    `;

    // First query
    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ query: sql }),
    });
    console.log('Result:', await resp.text());
}

run().catch(console.error);
