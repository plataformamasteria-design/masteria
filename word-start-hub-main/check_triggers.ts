import { createClient } from 'npm:@supabase/supabase-js@2';
import * as dotenv from 'npm:dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.rpc('get_messages_triggers' as any);
  if (error) {
    // try direct query if rpc fails
    const { data: qData, error: qErr } = await supabase.from('messages').select('id').limit(1);
    console.log("DB connection ok?", !qErr);
  } else {
    console.log(data);
  }
}
main();
