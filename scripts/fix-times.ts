import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';

async function run() {
  // Update messages that have a 3 hour lag (presumably from WhatsMeow).
  // We can do this by searching for recent messages (last 24 hours) where sent_at is extremely old compared to local.
  // Actually, let's just add 3 hours to messages sent by AGENT via Baileys today that have 10:xx instead of 13:xx.
  // A safe heuristic is fixing messages where provider_message_id length is less than 30 (not Dashboard generated).
  console.log("Fixing times...");
  await db.execute(sql`
    UPDATE messages 
    SET sent_at = sent_at + interval '3 hours' 
    WHERE provider_message_id IS NOT NULL 
    AND LENGTH(provider_message_id) < 30 
    AND sent_at > NOW() - interval '1 day'
    AND sent_at < NOW() - interval '1 hour';
  `);
  
  await db.execute(sql`
    UPDATE messages 
    SET sent_at = sent_at + interval '3 hours' 
    WHERE provider_message_id IS NULL 
    AND sender_type = 'CONTACT'
    AND sent_at > NOW() - interval '1 day'
    AND sent_at < NOW() - interval '1 hour';
  `);
  console.log("Times adjusted.");
  process.exit(0);
}
run();
