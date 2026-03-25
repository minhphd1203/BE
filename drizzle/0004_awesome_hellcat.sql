CREATE TABLE "report_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_system_auto_resolvable" boolean DEFAULT false NOT NULL,
	"auto_resolve_action" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_reasons_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "file_url" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "conversation_status" varchar(50) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "conversation_closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "conversation_closed_by" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "reason_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "reason_text" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "transaction_type" varchar(50) DEFAULT 'full_payment' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "remaining_balance" double precision;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_closed_by_users_id_fk" FOREIGN KEY ("conversation_closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reason_id_report_reasons_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."report_reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" DROP COLUMN "reason";