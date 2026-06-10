import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    const duplicates = await db.execute(sql`
        SELECT contact_id, company_id, array_agg(id ORDER BY last_message_at DESC) as convo_ids
        FROM conversations
        GROUP BY contact_id, company_id
        HAVING COUNT(*) > 1
    `);
    console.log(`Found ${duplicates.length} contacts with duplicated conversations.`);

    if (duplicates.length === 0) return process.exit(0);

    const tables = [
        'messages', '"agentTranscripts"', 'scheduled_messages', 
        'custom_fields_values', 'chat_assignments', 'ai_followup_queue'
    ];

    let count = 0;
    
    for (const row of duplicates) {
        const ids = row.convo_ids as string[];
        const primaryId = ids[0];
        const secondaryIds = ids.slice(1);
        const idsList = secondaryIds.map(id => `'${id}'`).join(',');

        try {
            for (const tbl of tables) {
                try {
                    await db.execute(sql.raw(`UPDATE ${tbl} SET conversation_id = '${primaryId}' WHERE conversation_id IN (${idsList})`));
                } catch(e) {}
            }
            
            await db.execute(sql.raw(`UPDATE conversations SET status = 'CLOSED', archived_at = NOW() WHERE id IN (${idsList})`));
            
            await db.execute(sql.raw(`
                UPDATE conversations 
                SET last_message_at = COALESCE(
                    (SELECT MAX(sent_at) FROM messages WHERE conversation_id = '${primaryId}'), 
                    last_message_at
                )
                WHERE id = '${primaryId}'
            `));
            count++;
            if (count % 50 === 0) console.log(`Processed ${count}/${duplicates.length}...`);
        } catch (e: any) {
            console.log("Error merging", row.contact_id, e.message);
        }
    }
    
    console.log("Done!");
}
main().then(() => process.exit(0)).catch(console.error);
