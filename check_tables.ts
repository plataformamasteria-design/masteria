import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function check() {
  try {
    const res: any = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('calendars', 'calendar_events', 'tasks', 'booking_config', 'bookings')`);
    console.log("Tables found:", Array.isArray(res) ? res.map((r: any) => r.table_name) : res.rows?.map((r: any) => r.table_name));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
