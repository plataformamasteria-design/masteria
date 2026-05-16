import 'dotenv/config';
import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function fix() {
    try {
        console.log('Adding status column to kanban_leads...');
        await db.execute(sql`ALTER TABLE kanban_leads ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE' NOT NULL;`);
        console.log('Column added successfully!');
    } catch (e: any) {
        console.error('Failed to add column:', e.message);
    }
    process.exit(0);
}
fix();
