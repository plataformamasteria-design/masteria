import { conn } from '../src/lib/db';

async function main() {
    const id = "42011dc3-3868-4b22-ab6c-5896e8352249";
    
    // Let's search ALL tables where id = this UUID, or name = this UUID.
    const tables = [
        'automations', 'automation_rules', 'automation_flows', 'incoming_webhook_configs', 
        'kanban_boards', 'webhooks', 'tags', 'contacts', 'campaigns'
    ];
    
    for (const table of tables) {
        try {
            const res = await conn.unsafe(`SELECT * FROM ${table} WHERE id = $1`, [id]);
            if (res.length > 0) {
                console.log(`Found in ${table} (by id):`, res);
            }
        } catch(e) { }
        try {
            const res2 = await conn.unsafe(`SELECT * FROM ${table} WHERE name = $1`, [id]);
            if (res2.length > 0) {
                console.log(`Found in ${table} (by name):`, res2);
            }
        } catch(e) {}
    }
    
    process.exit(0);
}
main().catch(console.error);
