CREATE TABLE "automation_flow_executions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"flow_id" text NOT NULL,
	"contact_id" text,
	"status" text NOT NULL,
	"current_step_id" text,
	"variables" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "automation_flows" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"visual_data" jsonb NOT NULL,
	"execution_logic" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_flow_executions" ADD CONSTRAINT "automation_flow_executions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_flow_executions" ADD CONSTRAINT "automation_flow_executions_flow_id_automation_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."automation_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_flow_executions" ADD CONSTRAINT "automation_flow_executions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_flows" ADD CONSTRAINT "automation_flows_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;