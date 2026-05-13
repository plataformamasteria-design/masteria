import { conn } from './src/lib/db/index.js';

async function run() {
  try {
    await conn`ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "google_calendar_id" text;`;
    console.log("Migration applied successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await conn.end();
  }
}

run();
