const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
CREATE TABLE IF NOT EXISTS system_settings (
  id text PRIMARY KEY DEFAULT 'global',
  openai_api_key text,
  gemini_api_key text,
  elevenlabs_api_key text,
  updated_at timestamp DEFAULT now() NOT NULL
);
`).then(() => {
  console.log('Table created successfully');
  return pool.query(`INSERT INTO system_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;`);
}).then(() => console.log('Row inserted')).catch(err => console.error(err)).finally(() => pool.end());
