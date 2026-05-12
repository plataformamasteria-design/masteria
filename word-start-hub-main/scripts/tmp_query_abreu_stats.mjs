import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envLines = fs.readFileSync('.env', 'utf-8').split('\n');
const env = {};
envLines.forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/"/g, '');
});

const SUPABASE_URL = env['SUPABASE_URL'] || env['VITE_SUPABASE_URL'];
// Need service role key, if not in .env, I'll use postgres query. Let's just use service_role from process.env if available, otherwise it might fail.
// Wait, my previous script failed because it used anon key. I know the Vitta IA conversation had a script `debug_db.mjs`!
