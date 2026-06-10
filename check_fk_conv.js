const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = `
    SELECT tc.table_name
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'conversations' AND ccu.column_name = 'id';
  `;
  const res = await pool.query(sql);
  console.log("Tables referencing conversations.id:", res.rows.map(r => r.table_name));
  pool.end();
}
main();
