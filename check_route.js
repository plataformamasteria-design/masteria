const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'; // Hardcoded for test
  // Wait, I can just query the DB exactly as the route does.
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = `
      WITH ranked_conversations AS (
        SELECT 
          c.id,
          c.connection_id as "connectionId",
          conn.config_name as "connectionName",
          conn.connection_type as "connectionType",
          conn.phone as "connectionPhone",
          c.status,
          c.last_message_at as "lastMessageAt",
          c.ai_active as "aiActive",
          c.assigned_to as "assignedTo",
          c.team_id as "teamId",
          u.name as "assignedUserName",
          ROW_NUMBER() OVER (PARTITION BY COALESCE(conn.phone, c.connection_id, 'SEM_CONEXAO') ORDER BY c.last_message_at DESC NULLS LAST) as rn
        FROM conversations c
        LEFT JOIN connections conn ON c.connection_id = conn.id
        LEFT JOIN users u ON c.assigned_to = u.id
        WHERE c.contact_id = '1141d685-1c51-4a2f-bab4-ad5e3bbb71b8'
          AND c.company_id = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'
          AND c.archived_at IS NULL
      )
      SELECT *
      FROM ranked_conversations
      WHERE rn = 1
      ORDER BY "lastMessageAt" DESC NULLS LAST
  `;
  const res = await pool.query(sql);
  console.log("activeConversations:", res.rows);
  pool.end();
}
main();
