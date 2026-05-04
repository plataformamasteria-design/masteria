CREATE TYPE "public"."agent_type" AS ENUM('GENERAL', 'ATENDIMENTO', 'SDR', 'VENDAS', 'ONBOARDING', 'RELATOR');--> statement-breakpoint
ALTER TABLE "ai_personas" ADD COLUMN "agent_type" "agent_type" DEFAULT 'GENERAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_personas" ADD COLUMN "kanban_board_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "default_kanban_board_id" text;