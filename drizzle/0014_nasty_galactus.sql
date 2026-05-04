CREATE TABLE "baileys_messages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" text NOT NULL,
	"jid" text NOT NULL,
	"message_id" text NOT NULL,
	"from_me" boolean DEFAULT false NOT NULL,
	"timestamp" integer,
	"content" jsonb,
	CONSTRAINT "baileys_messages_message_id_unique" UNIQUE("message_id")
);
