import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Altering pinned_chats...");

  const query = `
    ALTER TABLE pinned_chats
    ADD COLUMN IF NOT EXISTS scope text DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS filter_context text DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS target_team_id uuid REFERENCES teams(id) ON DELETE CASCADE;

    -- Drop any unique constraints that might prevent multiple pins per chat with different scopes/contexts
    -- But since we don't know the exact constraint name, let's just leave it or see if it fails.
    -- Usually it's (user_id, chat_id).
  `;

  // Actually, Supabase JS client cannot run raw SQL directly unless we use an RPC function or the postgres meta API.
  // Wait, let's see if there's an RPC we can use.
  const { data, error } = await supabase.rpc('execute_sql', { query });
  console.log('Result:', data, error);
}

main();
