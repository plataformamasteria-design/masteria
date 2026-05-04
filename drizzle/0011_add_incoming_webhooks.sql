-- Migration: Add incoming webhook tables
-- These tables support the incoming webhooks feature (Settings > Entrada)

-- Table: incoming_webhook_configs
-- Stores webhook endpoint configurations per company
CREATE TABLE IF NOT EXISTS "incoming_webhook_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "source" varchar(100) NOT NULL,
  "secret" varchar(255) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_incoming_webhook_configs_company"
  ON "incoming_webhook_configs" ("company_id");

-- Table: incoming_webhook_events
-- Stores received webhook event payloads for audit, replay and analytics
CREATE TABLE IF NOT EXISTS "incoming_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "source" varchar(100) NOT NULL,
  "event_type" varchar(100),
  "payload" jsonb NOT NULL DEFAULT '{}',
  "headers" jsonb DEFAULT '{}',
  "ip_address" varchar(50),
  "signature_valid" boolean DEFAULT false,
  "processed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_incoming_webhook_events_company"
  ON "incoming_webhook_events" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_incoming_webhook_events_type"
  ON "incoming_webhook_events" ("event_type");
CREATE INDEX IF NOT EXISTS "idx_incoming_webhook_events_created"
  ON "incoming_webhook_events" ("created_at");
