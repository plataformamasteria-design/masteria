ALTER TABLE "companies" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "lifetime" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kanban_boards" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "kanban_leads" ADD COLUMN "status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "connection_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_ads" ADD CONSTRAINT "marketing_ads_company_ad_unique" UNIQUE("company_id","ad_id");--> statement-breakpoint
ALTER TABLE "marketing_adsets" ADD CONSTRAINT "marketing_adsets_company_adset_unique" UNIQUE("company_id","adset_id");--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_company_campaign_unique" UNIQUE("company_id","campaign_id");