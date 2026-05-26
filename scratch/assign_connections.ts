require('dotenv').config({ path: '.env.local' });

// =====================================================================
// SCRIPT: Assign connections and agents to leads in first stage
// Period: 2026-05-22 to today
// Logic: Use the last message (sent or received) on the contact's
//        conversation to determine the connection → agent mapping.
//        If no message history → do not assign anyone.
// =====================================================================

const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
const DATE_FROM = new Date('2026-05-22T00:00:00-03:00');

const FUNNELS = [
  { name: 'FUNIL MENTORIA', boardId: '6bccc06c-4eb2-41e1-9c9d-5a133c267418', firstStageId: 'eb7468e0-580d-47bc-baa8-a5b38d697bfb' },
  { name: 'FUNIL ENCONTRO DE CASAIS', boardId: '72e90627-1f9c-493e-a243-71ef668c021a', firstStageId: 'bf1ffdda-39ba-454e-85d8-0223098702d2' },
  { name: 'FUNIL EVENTO GCR', boardId: 'b7f872be-03db-4e3a-832c-f7c746aa14cc', firstStageId: '42011dc3-3868-4b22-ab6c-5896e8352249' },
  { name: 'FUNIL EDN [ATUAL]', boardId: 'b8856169-d5ee-40ea-a876-20c8b46234cf', firstStageId: '591eedbd-d322-47fa-95f9-dba4697ef5ac' },
];

// Connection name → Agent User ID mapping (from user instructions)
// We will query the actual connection IDs from DB and build this map dynamically

async function main() {
  const { db } = await import('../src/lib/db');
  const { kanbanLeads, contacts, conversations, messages, connections, users } = await import('../src/lib/db/schema');
  const { eq, and, inArray, gte, isNull, sql } = await import('drizzle-orm');

  // -------------------------------------------------------
  // Step 1: Build Connection → User mapping from DB
  // -------------------------------------------------------
  const allConnections = await db.select().from(connections).where(eq(connections.companyId, COMPANY_ID));
  const allUsers = await db.select().from(users).where(eq(users.companyId, COMPANY_ID));

  // Map config_name (lowercase) → connection id
  const connByName: Record<string, string> = {};
  for (const c of allConnections) {
    const name = ((c as any).config_name || '').toLowerCase().trim();
    if (name) connByName[name] = c.id;
  }

  console.log('Connections found:');
  for (const c of allConnections) {
    console.log(`  "${(c as any).config_name}" → ${c.id}`);
  }

  // Map agent name (lowercase) → user id
  const userByName: Record<string, string> = {};
  for (const u of allUsers) {
    const name = (u.name || u.email || '').toLowerCase().trim();
    userByName[name] = u.id;
  }

  // Instruction mapping: connection name pattern → agent name
  const connectionToAgentName: Record<string, string> = {
    'jorge junior': 'jorge junior',
    'andre adegas': 'andrea adegas',
    'andrea adegas': 'andrea adegas',
    'guilherme macedo': 'guilherme macedo',
    'bruno macedo': 'bruno macedo',
    'anderson meneses': 'anderson menezes',
    'anderson menezes': 'anderson menezes',
    'heitor santos': 'usuário teste',
    'camila brandão': 'camila brandao',
    'camila brandao': 'camila brandao',
  };

  // Build final: connection_id → user_id
  const connIdToUserId: Record<string, string | null> = {};
  for (const c of allConnections) {
    const cName = ((c as any).config_name || '').toLowerCase().trim();
    // Try exact match first, then partial match
    let agentName = connectionToAgentName[cName];
    if (!agentName) {
      // Try partial match
      for (const [pattern, agent] of Object.entries(connectionToAgentName)) {
        if (cName.includes(pattern) || pattern.includes(cName)) {
          agentName = agent;
          break;
        }
      }
    }
    const userId = agentName ? (userByName[agentName] || null) : null;
    connIdToUserId[c.id] = userId;
    console.log(`  Mapping conn "${(c as any).config_name}" → agent "${agentName}" (userId: ${userId})`);
  }

  // -------------------------------------------------------
  // Step 2: For each funnel, find leads in first stage 
  //         created from 22/05 onwards
  // -------------------------------------------------------
  let totalLeads = 0;
  let assigned = 0;
  let skipped_no_messages = 0;
  let already_assigned = 0;

  for (const funnel of FUNNELS) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Funnel: ${funnel.name}`);

    // Get leads in first stage created >= 22/05
    const leadsInFirstStage = await db.query.kanbanLeads.findMany({
      where: and(
        eq(kanbanLeads.boardId, funnel.boardId),
        eq(kanbanLeads.stageId, funnel.firstStageId),
        gte(kanbanLeads.createdAt, DATE_FROM)
      ),
      with: { contact: true }
    });

    console.log(`  Leads in first stage (22/05+): ${leadsInFirstStage.length}`);
    totalLeads += leadsInFirstStage.length;

    if (leadsInFirstStage.length === 0) continue;

    const contactIds = leadsInFirstStage.map((l: any) => l.contactId).filter(Boolean);

    // Get all conversations for these contacts
    let convList: any[] = [];
    for (let i = 0; i < contactIds.length; i += 200) {
      const chunk = contactIds.slice(i, i + 200);
      const res = await db.query.conversations.findMany({
        where: and(
          eq(conversations.companyId, COMPANY_ID),
          inArray(conversations.contactId, chunk)
        )
      });
      convList = convList.concat(res);
    }

    // Build map: contactId → list of conversations
    const convsByContact: Record<string, any[]> = {};
    for (const c of convList) {
      if (!convsByContact[c.contactId]) convsByContact[c.contactId] = [];
      convsByContact[c.contactId].push(c);
    }

    // Get last message for each conversation to determine the active connection
    const convIds = convList.map(c => c.id).filter(Boolean);
    const lastMsgByConvId: Record<string, { connectionId: string; sentAt: Date }> = {};

    if (convIds.length > 0) {
      // Use raw SQL to get last message per conversation
      const result = await db.execute(sql`
        SELECT DISTINCT ON (m.conversation_id) 
          m.conversation_id::text,
          m.sent_at,
          c.connection_id::text
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.conversation_id::text = ANY(ARRAY[${sql.join(convIds.map(id => sql`${id}`), sql`, `)}])
        ORDER BY m.conversation_id, m.sent_at DESC
      `);

      for (const row of (result as any).rows || result as any[]) {
        if (row.conversation_id && row.connection_id) {
          lastMsgByConvId[row.conversation_id] = {
            connectionId: row.connection_id,
            sentAt: row.sent_at
          };
        }
      }
    }

    console.log(`  Conversations found: ${convList.length}, with messages: ${Object.keys(lastMsgByConvId).length}`);

    // -------------------------------------------------------
    // Step 3: For each lead, determine assignment
    // -------------------------------------------------------
    for (const lead of leadsInFirstStage) {
      const contactConvs = convsByContact[lead.contactId] || [];

      if (contactConvs.length === 0) {
        // No conversation at all → skip
        skipped_no_messages++;
        continue;
      }

      // Find the conversation with the most recent message
      let bestConvId: string | null = null;
      let bestConnectionId: string | null = null;
      let bestSentAt: Date | null = null;

      for (const conv of contactConvs) {
        const lastMsg = lastMsgByConvId[conv.id];
        if (!lastMsg) continue;
        if (!bestSentAt || lastMsg.sentAt > bestSentAt) {
          bestConvId = conv.id;
          bestConnectionId = lastMsg.connectionId;
          bestSentAt = lastMsg.sentAt;
        }
      }

      if (!bestConvId || !bestConnectionId) {
        // Conversations exist but no messages → skip
        skipped_no_messages++;
        continue;
      }

      const targetUserId = connIdToUserId[bestConnectionId] ?? null;

      // Find the conversation object
      const bestConv = contactConvs.find(c => c.id === bestConvId);
      if (!bestConv) continue;

      // Check if already correctly assigned
      if (bestConv.assignedTo === targetUserId && bestConv.connectionId === bestConnectionId) {
        already_assigned++;
        continue;
      }

      // Update conversation
      try {
        await db.update(conversations)
          .set({
            assignedTo: targetUserId,
            connectionId: bestConnectionId,
          })
          .where(eq(conversations.id, bestConvId));
        assigned++;
        
        const contact = (lead as any).contact;
        const connName = allConnections.find(c => c.id === bestConnectionId);
        const agentName = allUsers.find(u => u.id === targetUserId);
        console.log(`  ✅ Lead: ${contact?.name} → Conn: ${(connName as any)?.config_name || bestConnectionId} → Agent: ${agentName?.name || 'null'}`);
      } catch (err: any) {
        console.error(`  ❌ Error updating conv ${bestConvId}: ${err.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total leads analyzed: ${totalLeads}`);
  console.log(`✅ Conversations assigned/updated: ${assigned}`);
  console.log(`⏭️  Skipped (no messages): ${skipped_no_messages}`);
  console.log(`⏭️  Already correctly assigned: ${already_assigned}`);

  process.exit(0);
}

main().catch(console.error);
