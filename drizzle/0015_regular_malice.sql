ALTER TABLE "automation_flows" ADD COLUMN "trigger_type" text DEFAULT 'stage_entry' NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_flows" ADD COLUMN "webhook_token" text;--> statement-breakpoint
ALTER TABLE "automation_flows" ADD COLUMN "schedule_config" jsonb;--> statement-breakpoint
ALTER TABLE "baileys_messages" ADD COLUMN "conversation_id" text;--> statement-breakpoint
ALTER TABLE "baileys_messages" ADD COLUMN "text" text;