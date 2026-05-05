CREATE TYPE "public"."agency_approval_status" AS ENUM('waiting', 'approved', 'rejected', 'change_requested', 'approved_with_notes');--> statement-breakpoint
CREATE TYPE "public"."agency_campaign_stage" AS ENUM('not_started', 'strategic_planning', 'creative_planning', 'schedule_execution', 'post_sale', 'finished');--> statement-breakpoint
CREATE TYPE "public"."agency_client_status" AS ENUM('onboarding', 'active', 'paused', 'reviewing', 'finished');--> statement-breakpoint
CREATE TYPE "public"."agency_content_status" AS ENUM('idea', 'in_production', 'in_editing', 'in_approval', 'approved', 'scheduled', 'published', 'delayed');--> statement-breakpoint
CREATE TYPE "public"."agency_material_status" AS ENUM('received', 'analyzing', 'approved', 'rejected', 'needs_update', 'archived');--> statement-breakpoint
CREATE TABLE "agency_approvals" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"client_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'internal' NOT NULL,
	"status" "agency_approval_status" DEFAULT 'waiting' NOT NULL,
	"requested_by_id" text,
	"reviewed_by_id" text,
	"deadline_at" timestamp,
	"reviewed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agency_campaigns" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"month" text,
	"plan" text,
	"objective" text,
	"main_offer" text,
	"channel" text,
	"stage" "agency_campaign_stage" DEFAULT 'not_started' NOT NULL,
	"strategic_manager_id" text,
	"designer_id" text,
	"copywriter_id" text,
	"traffic_manager_id" text,
	"start_date" date,
	"delivery_date" date,
	"checklist" jsonb DEFAULT '{}'::jsonb,
	"observations" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agency_clients" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"company_name" text,
	"niche" text,
	"specialty" text,
	"city" text,
	"state" text,
	"instagram" text,
	"site" text,
	"whatsapp" text,
	"manager_id" text,
	"designer_id" text,
	"traffic_manager_id" text,
	"copywriter_id" text,
	"plan" text DEFAULT 'bronze',
	"start_date" date,
	"next_delivery" date,
	"status" "agency_client_status" DEFAULT 'onboarding' NOT NULL,
	"notes" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agency_comments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"content" text NOT NULL,
	"author_id" text,
	"parent_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agency_contents" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"client_id" text NOT NULL,
	"campaign_id" text,
	"title" text NOT NULL,
	"content_type" text,
	"format" text,
	"sector" text,
	"method" text,
	"stage" text,
	"channel" text,
	"briefing" text,
	"script" text,
	"caption" text,
	"references" text,
	"urgency" text DEFAULT 'normal',
	"status" "agency_content_status" DEFAULT 'idea' NOT NULL,
	"approval_status" text,
	"deadline" date,
	"publish_date" date,
	"published_at" timestamp,
	"responsible_id" text,
	"requester_id" text,
	"has_cover" boolean DEFAULT false NOT NULL,
	"has_video" boolean DEFAULT false NOT NULL,
	"has_report" boolean DEFAULT false NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"observations" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agency_materials" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"file_type" text,
	"mime_type" text,
	"file_size" integer,
	"s3_key" text,
	"s3_url" text,
	"external_link" text,
	"thumbnail_url" text,
	"tags" text[],
	"status" "agency_material_status" DEFAULT 'received' NOT NULL,
	"observations" text,
	"uploaded_by_id" text,
	"specialty" text,
	"linked_content_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agency_tasks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"client_id" text,
	"entity_type" text,
	"entity_id" text,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'normal',
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to_id" text,
	"created_by_id" text,
	"due_date" date,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_credentials" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"openai_api_key" text,
	"gemini_api_key" text,
	"elevenlabs_api_key" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_financials" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"monthly_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"implementation_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"fixed_costs" numeric(10, 2) DEFAULT '0' NOT NULL,
	"variable_costs" numeric(10, 2) DEFAULT '0' NOT NULL,
	"payment_day" integer DEFAULT 10 NOT NULL,
	"last_payment_date" timestamp,
	"total_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"openai_api_key" text,
	"gemini_api_key" text,
	"elevenlabs_api_key" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "exclude_list_ids" text[];--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "tag_ids" text[];--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "exclude_tag_ids" text[];--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "funnel_ids" text[];--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "funnel_stage_ids" text[];--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "ai_transcription" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "agency_approvals" ADD CONSTRAINT "agency_approvals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_approvals" ADD CONSTRAINT "agency_approvals_client_id_agency_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."agency_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_approvals" ADD CONSTRAINT "agency_approvals_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_approvals" ADD CONSTRAINT "agency_approvals_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_campaigns" ADD CONSTRAINT "agency_campaigns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_campaigns" ADD CONSTRAINT "agency_campaigns_client_id_agency_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."agency_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_campaigns" ADD CONSTRAINT "agency_campaigns_strategic_manager_id_users_id_fk" FOREIGN KEY ("strategic_manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_campaigns" ADD CONSTRAINT "agency_campaigns_designer_id_users_id_fk" FOREIGN KEY ("designer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_campaigns" ADD CONSTRAINT "agency_campaigns_copywriter_id_users_id_fk" FOREIGN KEY ("copywriter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_campaigns" ADD CONSTRAINT "agency_campaigns_traffic_manager_id_users_id_fk" FOREIGN KEY ("traffic_manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_clients" ADD CONSTRAINT "agency_clients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_clients" ADD CONSTRAINT "agency_clients_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_clients" ADD CONSTRAINT "agency_clients_designer_id_users_id_fk" FOREIGN KEY ("designer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_clients" ADD CONSTRAINT "agency_clients_traffic_manager_id_users_id_fk" FOREIGN KEY ("traffic_manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_clients" ADD CONSTRAINT "agency_clients_copywriter_id_users_id_fk" FOREIGN KEY ("copywriter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_comments" ADD CONSTRAINT "agency_comments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_comments" ADD CONSTRAINT "agency_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_contents" ADD CONSTRAINT "agency_contents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_contents" ADD CONSTRAINT "agency_contents_client_id_agency_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."agency_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_contents" ADD CONSTRAINT "agency_contents_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_contents" ADD CONSTRAINT "agency_contents_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_materials" ADD CONSTRAINT "agency_materials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_materials" ADD CONSTRAINT "agency_materials_client_id_agency_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."agency_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_materials" ADD CONSTRAINT "agency_materials_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_materials" ADD CONSTRAINT "agency_materials_linked_content_id_agency_contents_id_fk" FOREIGN KEY ("linked_content_id") REFERENCES "public"."agency_contents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_tasks" ADD CONSTRAINT "agency_tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_tasks" ADD CONSTRAINT "agency_tasks_client_id_agency_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."agency_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_tasks" ADD CONSTRAINT "agency_tasks_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_tasks" ADD CONSTRAINT "agency_tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_credentials" ADD CONSTRAINT "company_credentials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_financials" ADD CONSTRAINT "company_financials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;