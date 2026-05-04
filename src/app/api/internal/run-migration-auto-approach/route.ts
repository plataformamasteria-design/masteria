// src/app/api/internal/run-migration-auto-approach/route.ts
// Migration: Add auto-approach fields to incoming_webhook_configs + create webhook_approach_logs table
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-internal-key');
    if (authHeader !== process.env.JWT_SECRET_KEY_CALL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🚀 Running migration: auto-approach webhook fields');

    // 1. Add auto_approach columns to incoming_webhook_configs
    await db.execute(sql`
      ALTER TABLE "incoming_webhook_configs"
        ADD COLUMN IF NOT EXISTS "auto_approach_enabled" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "auto_approach_connection_id" uuid,
        ADD COLUMN IF NOT EXISTS "auto_approach_message" text DEFAULT '',
        ADD COLUMN IF NOT EXISTS "auto_approach_delay_seconds" integer DEFAULT 5,
        ADD COLUMN IF NOT EXISTS "auto_approach_ai_persona_id" uuid;
    `);
    console.log('✅ Auto-approach columns added to incoming_webhook_configs');

    // 2. Create webhook_approach_logs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "webhook_approach_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
        "webhook_config_id" uuid NOT NULL,
        "contact_id" uuid NOT NULL,
        "connection_id" uuid NOT NULL,
        "phone" varchar(30) NOT NULL,
        "message_sent" text NOT NULL,
        "message_id" varchar(255),
        "status" varchar(20) DEFAULT 'PENDING',
        "error" text,
        "approach_type" varchar(20) DEFAULT 'template',
        "webhook_event_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);
    console.log('✅ webhook_approach_logs table created');

    // 3. Create indexes for deduplication and queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_approach_logs_company_phone"
        ON "webhook_approach_logs" ("company_id", "phone", "created_at" DESC);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_approach_logs_dedup"
        ON "webhook_approach_logs" ("company_id", "contact_id", "created_at" DESC);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_approach_logs_config"
        ON "webhook_approach_logs" ("webhook_config_id", "created_at" DESC);
    `);
    console.log('✅ Indexes created');

    // 4. Verify
    const check = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'incoming_webhook_configs' 
      AND column_name LIKE 'auto_approach%';
    `);

    const tableCheck = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'webhook_approach_logs';
    `);

    console.log('✅ Migration completed:', { columns: check, tables: tableCheck });

    return NextResponse.json({
      success: true,
      message: 'Auto-approach migration completed',
      newColumns: Array.from(check),
      newTables: Array.from(tableCheck),
    });
  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({
      error: (error as Error).message,
    }, { status: 500 });
  }
}
