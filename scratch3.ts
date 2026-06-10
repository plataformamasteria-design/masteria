import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function test() {
  const companyId = 'some-company-id'; // using a dummy company id just to generate the SQL
  const user = { role: 'atendente', id: 'user-id', permissions: { viewMode: 'assigned_only', allowedConnectionIds: ['conn1', 'conn2'] } };
  
  let whereConditions = sql`c.company_id = ${companyId}`;

  const viewMode = user.permissions?.viewMode || 'all';
  const isAssignedOnly = user.role === 'atendente' && viewMode === 'assigned_only';
  const allowedConnectionIds = user.role === 'atendente' ? (user.permissions?.allowedConnectionIds || []) : null;

  if (user.role === 'atendente') {
      let connectionClause = sql`true`;
      let assignmentClause = sql`true`;

      if (allowedConnectionIds && allowedConnectionIds.length > 0) {
          const inClause = sql.join(allowedConnectionIds.map((id: string) => sql`${id}`), sql`, `);
          connectionClause = sql`conv.connection_id IN (${inClause})`;
      } else if (allowedConnectionIds && allowedConnectionIds.length === 0) {
          connectionClause = sql`false`;
      }

      if (isAssignedOnly) {
          assignmentClause = sql`conv.assigned_to = ${user.id}`;
      }

      const visibilityFilter = sql`EXISTS (SELECT 1 FROM conversations conv WHERE conv.contact_id = c.id AND ${connectionClause} AND ${assignmentClause})`;
      whereConditions = sql`${whereConditions} AND ${visibilityFilter}`;
  }

  const countQuery = sql`
          SELECT COUNT(DISTINCT c.id) as value
          FROM contacts c
          WHERE ${whereConditions}
      `;
      
  console.log("SQL:", countQuery);
}

test().catch(console.error).finally(() => process.exit(0));
