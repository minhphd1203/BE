-- Refunds table for tracking buyer refund requests
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL REFERENCES "transactions"("id"),
	"buyer_id" uuid NOT NULL REFERENCES "users"("id"),
	"seller_id" uuid NOT NULL REFERENCES "users"("id"),
	"amount" double precision NOT NULL,
	"reason" varchar(500) NOT NULL,
	"status" varchar(50) NOT NULL DEFAULT 'completed', -- pending, completed, rejected
	"rejected_reason" text,
	"processed_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_refunds_transaction_id" ON "refunds"("transaction_id");
--> statement-breakpoint
CREATE INDEX "idx_refunds_buyer_id" ON "refunds"("buyer_id");
--> statement-breakpoint
CREATE INDEX "idx_refunds_seller_id" ON "refunds"("seller_id");
