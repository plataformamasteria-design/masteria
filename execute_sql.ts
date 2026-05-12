import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';

async function run() {
  try {
    const content = fs.readFileSync('drizzle/0017_white_leech.sql', 'utf8');
    const agendaTables = ['"calendars"', '"calendar_events"', '"tasks"', '"booking_config"', '"bookings"'];
    const statements = content.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      if (agendaTables.some(t => stmt.includes(t))) {
        try {
          console.log('Executing: ', stmt.slice(0, 50) + '...');
          await db.execute(sql.raw(stmt));
        } catch (e: any) {
          console.warn('Skipping or Error on', stmt.slice(0, 30), e.message);
        }
      }
    }
    console.log('Done!');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
