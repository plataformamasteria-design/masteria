const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
  
  // Normalize phone by removing +, -, spaces, and parentheses
  const sql = `
    WITH normalized_contacts AS (
      SELECT 
        id, 
        name, 
        phone,
        created_at,
        REGEXP_REPLACE(phone, '[^0-9]', '', 'g') AS num
      FROM contacts 
      WHERE company_id = $1
    ),
    stripped_contacts AS (
      SELECT 
        id, name, phone, created_at, num,
        CASE 
          WHEN num LIKE '55%' THEN SUBSTRING(num FROM 3)
          ELSE num 
        END AS local_num
      FROM normalized_contacts
    )
    SELECT 
      local_num, 
      COUNT(*) as count, 
      ARRAY_AGG(id) as ids,
      ARRAY_AGG(phone) as phones,
      ARRAY_AGG(name) as names
    FROM stripped_contacts
    WHERE local_num IS NOT NULL AND local_num != ''
    GROUP BY local_num
    HAVING COUNT(*) > 1
    ORDER BY count DESC;
  `;
  const res = await pool.query(sql, [companyId]);
  console.log("Duplicated Contacts:", JSON.stringify(res.rows, null, 2));
  
  const totalSql = `SELECT COUNT(*) FROM contacts WHERE company_id = $1`;
  const totalRes = await pool.query(totalSql, [companyId]);
  console.log("Total contacts in org:", totalRes.rows[0].count);
  
  pool.end();
}
main();
